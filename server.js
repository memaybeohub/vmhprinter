const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public')); 
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// ==========================================
// CẤU HÌNH OAUTH2 
// ==========================================
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// ==========================================
// BỘ NHỚ TẠM TỔNG HỢP ĐƠN TRONG NGÀY
// ==========================================
let dailyOrders = [];
let currentDayTracker = new Date().getDate();

// Hàm tìm hoặc tạo thư mục
async function findOrCreateFolder(folderName, parentId) {
    if (!parentId || parentId.trim() === '') {
        throw new Error("Lỗi: Không tìm thấy ID thư mục cha!");
    }
    try {
        const query = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${folderName}' and '${parentId}' in parents`;
        const response = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });

        if (response.data.files.length > 0) {
            return response.data.files[0].id;
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        return folder.data.id;
    } catch (error) {
        console.error(`Lỗi khi tìm/tạo folder ${folderName}:`, error.message);
        throw error;
    }
}

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const userName = req.body.fullName || 'Unknown_User';
        const coordinates = req.body.coordinates || 'Chưa cung cấp toạ độ';
        const deliveryTime = req.body.deliveryTime || 'Không yêu cầu'; 
        // Lấy số tiền từ App gửi lên và Format
        const rawPrice = parseInt(req.body.totalPrice, 10) || 0;
        const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rawPrice);

        const files = req.files;
        const rootFolderId = process.env.DRIVE_PARENT_FOLDER_ID;

        if (!rootFolderId || rootFolderId.includes('http')) {
            throw new Error("Cấu hình DRIVE_PARENT_FOLDER_ID bị sai.");
        }
        if (files.length === 0) {
            throw new Error("Không có file nào được gửi lên.");
        }

        const now = new Date();
        const vnTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
        
        if (vnTime.getDate() !== currentDayTracker) {
            dailyOrders = []; 
            currentDayTracker = vnTime.getDate();
        }

        const dateString = `${vnTime.getDate()}/${vnTime.getMonth() + 1}`;
        const timeString = `${vnTime.getHours()}h${vnTime.getMinutes()}`;
        
        const folderName = `${userName} ${timeString} ngày ${dateString}`;

        const dateFolderId = await findOrCreateFolder(dateString, rootFolderId);
        const userFolderId = await findOrCreateFolder(folderName, dateFolderId);

        const uploadPromises = files.map(async (file) => {
            const fileMetadata = { name: file.originalname, parents: [userFolderId] };
            const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

            const uploadedFile = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            fs.unlinkSync(file.path); 
            return uploadedFile.data.id;
        });

        await Promise.all(uploadPromises);

        // ==========================================
        // XỬ LÝ SẮP XẾP VÀ TỔNG HỢP ĐƠN
        // ==========================================
        let parsedHour = 24; 
        const timeMatch = deliveryTime.match(/(\d+)/);
        if (timeMatch) {
            parsedHour = parseInt(timeMatch[1], 10);
        }

        dailyOrders.push({
            name: userName,
            coords: coordinates,
            time: deliveryTime,
            hour: parsedHour,
            price: formattedPrice // Lưu thêm tiền vào bộ nhớ tạm
        });

        dailyOrders.sort((a, b) => a.hour - b.hour);

        let summaryText = "\n\n--------------------------\n**📋 LỊCH TRÌNH CẦN GIAO HÔM NAY:**\n";
        dailyOrders.forEach((order, index) => {
            // Thêm tiền vào từng dòng tổng hợp
            summaryText += `\`${index + 1}.\` **${order.time}** - ${order.name} (📍 ${order.coords}) - 💵 **Thu: ${order.price}**\n`;
        });

        // ==========================================
        // BẮN THÔNG BÁO DISCORD
        // ==========================================
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            const folderLink = `https://drive.google.com/drive/folders/${userFolderId}`;
            const mapLink = `https://www.google.com/maps?q=${coordinates.replace(/\s/g, '')}`;
            
            // Tin nhắn Discord bổ sung thêm dòng "💵 Cần thu"
            const discordMessage = `<@884662992921313352> có file in mới!\n👤 Người nhận: **${userName}**\n📍 Toạ độ: **${coordinates}**\n⏰ Giờ giao hàng: **${deliveryTime}**\n💵 Cần thu: **${formattedPrice}**\n🗺️ Xem bản đồ: ${mapLink}\n📁 Link tải file: ${folderLink}${summaryText}`;

            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: discordMessage })
                });
            } catch (discordErr) {
                console.error('Lỗi khi gửi webhook Discord:', discordErr);
            }
        }

        res.status(200).json({ message: 'Tải lên thành công!', status: 'success' });
    } catch (error) {
        console.error("Lỗi API Upload:", error.message);
        res.status(500).json({ message: error.message || 'Có lỗi xảy ra trong quá trình upload.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
});

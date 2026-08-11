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
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

let dailyOrders = [];
let currentDayTracker = new Date().getDate();

async function findOrCreateFolder(folderName, parentId) {
    if (!parentId) throw new Error("Thiếu ID thư mục cha!");
    try {
        const query = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${folderName}' and '${parentId}' in parents`;
        const response = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });
        if (response.data.files.length > 0) return response.data.files[0].id;

        const folder = await drive.files.create({
            resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
            fields: 'id'
        });
        return folder.data.id;
    } catch (error) { throw error; }
}

// ==========================================
// 1. API MÁY IN (Có Discord Webhook)
// ==========================================
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const userName = req.body.fullName || 'Unknown_User';
        const coordinates = req.body.coordinates || 'Chưa cung cấp';
        const deliveryTime = req.body.deliveryTime || 'Không yêu cầu';
        const rawPrice = parseInt(req.body.totalPrice, 10) || 0;
        const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rawPrice);
        const fileDetails = JSON.parse(req.body.fileDetails || '[]');

        const files = req.files;
        const rootFolderId = process.env.DRIVE_PARENT_FOLDER_ID;

        if (!rootFolderId) throw new Error("Thiếu cấu hình thư mục máy in.");
        if (files.length === 0) throw new Error("Không có file.");

        const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        if (vnTime.getDate() !== currentDayTracker) {
            dailyOrders = [];
            currentDayTracker = vnTime.getDate();
        }

        const dateString = `${vnTime.getDate()}/${vnTime.getMonth() + 1}`;
        const timeString = `${vnTime.getHours()}h${vnTime.getMinutes()}`;
        const folderName = `${userName} ${timeString} ngày ${dateString}`;

        const dateFolderId = await findOrCreateFolder(dateString, rootFolderId);
        const userFolderId = await findOrCreateFolder(folderName, dateFolderId);

        // ==========================================
        // TẠO FILE HÓA ĐƠN (BILL) HTML CÓ THỂ IN ĐƯỢC
        // ==========================================
        let rowsHtml = '';
        let totalPagesAll = 0;
        fileDetails.forEach((f, index) => {
            const qty = f.quantity || 1;
            const totalFilePages = (f.pages === '...' ? 1 : f.pages) * qty;
            totalPagesAll += totalFilePages;
            rowsHtml += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${f.name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${f.pages}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><strong>x${qty}</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${totalFilePages}</td>
                </tr>
            `;
        });

        const billHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Hóa Đơn - ${userName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 800px; margin: 0 auto; }
                h2 { text-align: center; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                .info p { margin: 5px 0; font-size: 1.1em; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f3f4f6; padding: 12px; text-align: center; border: 1px solid #ddd; }
                .total { margin-top: 20px; text-align: right; font-size: 1.2em; }
                .price { color: #e11d48; font-size: 1.5em; font-weight: bold; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <button class="no-print" onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 5px; cursor: pointer; float: right;">🖨️ In Hóa Đơn Này</button>
            <h2>HÓA ĐƠN IN ẤN</h2>
            <div class="info">
                <p><strong>Khách hàng:</strong> ${userName}</p>
                <p><strong>Thời gian đặt:</strong> ${timeString} ngày ${dateString}</p>
                <p><strong>Giờ giao hàng:</strong> ${deliveryTime}</p>
                <p><strong>Toạ độ giao:</strong> ${coordinates}</p>
            </div>
            <table>
                <thead>
                    <tr><th>STT</th><th>Tên File</th><th>Số trang/bản</th><th>Số lượng</th><th>Tổng trang</th></tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div class="total">
                <p>Tổng số trang: <strong>${totalPagesAll}</strong></p>
                <p>Thành tiền: <span class="price">${formattedPrice}</span></p>
            </div>
        </body>
        </html>
        `;

        // Lưu file Hóa đơn tạm thời
        const billFileName = `[HOA_DON]_Khach_${userName.replace(/\s/g, '_')}.html`;
        const billFilePath = path.join(__dirname, 'uploads', billFileName);
        fs.writeFileSync(billFilePath, billHtml);

        // Đưa file Hóa đơn vào mảng để up chung với các file tài liệu
        const allFilesToUpload = [...files, {
            originalname: billFileName,
            mimetype: 'text/html',
            path: billFilePath
        }];

        // Vòng lặp upload toàn bộ file (tuần tự từng file để tránh chống Spam của Google)
        for (const file of allFilesToUpload) {
            await drive.files.create({
                resource: { name: file.originalname, parents: [userFolderId] },
                media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
                fields: 'id'
            });
            fs.unlinkSync(file.path); 
        }

        let parsedHour = 24;
        const timeMatch = deliveryTime.match(/(\d+)/);
        if (timeMatch) parsedHour = parseInt(timeMatch[1], 10);

        dailyOrders.push({ name: userName, coords: coordinates, time: deliveryTime, hour: parsedHour, price: formattedPrice });
        dailyOrders.sort((a, b) => a.hour - b.hour);

        let summaryText = "\n\n--------------------------\n**📋 LỊCH TRÌNH CẦN GIAO HÔM NAY:**\n";
        dailyOrders.forEach((order, index) => {
            summaryText += `\`${index + 1}.\` **${order.time}** - ${order.name} (📍 Toạ độ: ${order.coords}) - 💵 **Thu: ${order.price}**\n`;
        });

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            const folderLink = `https://drive.google.com/drive/folders/${userFolderId}`;
            const mapLink = `https://www.google.com/maps?q=${coordinates.replace(/\s/g, '')}`;
            const discordMessage = `<@884662992921313352> có file in mới!\n👤 Người nhận: **${userName}**\n📍 Toạ độ: **${coordinates}**\n⏰ Giờ: **${deliveryTime}**\n💵 Cần thu: **${formattedPrice}**\n🗺️ Bản đồ: ${mapLink}\n📁 Link file: ${folderLink}${summaryText}`;
            
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: discordMessage })
            }).catch(console.error);
        }

        // Trả về kèm billHtml để hiển thị nút in
        res.status(200).json({ status: 'success', billHtml: billHtml });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==========================================
// 2. API Ổ ĐĨA ĐÁM MÂY MINI
// ==========================================
app.post('/api/cloud-upload', upload.array('files'), async (req, res) => {
    try {
        const email = req.body.email || '';
        const files = req.files;
        const cloudRootId = process.env.CLOUD_PARENT_FOLDER_ID;

        if (!cloudRootId) throw new Error("Chưa cấu hình CLOUD_PARENT_FOLDER_ID.");
        if (files.length === 0) throw new Error("Không có file.");

        const timestampFolder = `Upload_${Date.now()}`;
        const batchFolderId = await findOrCreateFolder(timestampFolder, cloudRootId);

        // Upload files
        let uploadedFilesData = [];
        for (const file of files) {
            const uploadedFile = await drive.files.create({
                resource: { name: file.originalname, parents: [batchFolderId] },
                media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
                fields: 'id, name, webViewLink'
            });
            fs.unlinkSync(file.path);
            
            uploadedFilesData.push({
                id: uploadedFile.data.id,
                name: uploadedFile.data.name,
                link: uploadedFile.data.webViewLink,
                date: new Date().toLocaleString("vi-VN")
            });
        }

        // Share thư mục cho email nếu có
        if (email.includes('@')) {
            await drive.permissions.create({
                fileId: batchFolderId,
                requestBody: { type: 'user', role: 'reader', emailAddress: email }
            });
        }

        res.status(200).json({ status: 'success', files: uploadedFilesData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Hủy công khai file (Chỉ giữ lại quyền của mail được cấp)
app.post('/api/cloud-private', async (req, res) => {
    try {
        const { fileId } = req.body;
        
        // 1. Lấy danh sách các quyền (permissions) hiện tại của file trên Drive
        const permissions = await drive.permissions.list({
            fileId: fileId,
            fields: 'permissions(id, type, role)'
        });

        // 2. Tìm và xóa quyền có kiểu là 'anyone' (công khai)
        const publicPermission = permissions.data.permissions.find(p => p.type === 'anyone');
        if (publicPermission) {
            await drive.permissions.delete({
                fileId: fileId,
                permissionId: publicPermission.id
            });
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Bật công khai file
app.post('/api/cloud-public', async (req, res) => {
    try {
        const { fileId } = req.body;
        await drive.permissions.create({
            fileId: fileId,
            requestBody: { type: 'anyone', role: 'reader' }
        });
        res.status(200).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Xóa file
app.post('/api/cloud-delete', async (req, res) => {
    try {
        const { fileId } = req.body;
        await drive.files.delete({ fileId: fileId });
        res.status(200).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
});

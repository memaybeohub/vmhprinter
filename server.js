const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const cors = require('cors');
const fs = require('fs');
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

        const uploadPromises = files.map(async (file) => {
            const uploadedFile = await drive.files.create({
                resource: { name: file.originalname, parents: [userFolderId] },
                media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
                fields: 'id'
            });
            fs.unlinkSync(file.path);
            return uploadedFile.data.id;
        });

        await Promise.all(uploadPromises);

        let parsedHour = 24;
        const timeMatch = deliveryTime.match(/(\d+)/);
        if (timeMatch) parsedHour = parseInt(timeMatch[1], 10);

        dailyOrders.push({ name: userName, coords: coordinates, time: deliveryTime, hour: parsedHour });
        dailyOrders.sort((a, b) => a.hour - b.hour);

        let summaryText = "\n\n--------------------------\n**📋 LỊCH TRÌNH CẦN GIAO HÔM NAY:**\n";
        dailyOrders.forEach((order, index) => {
            summaryText += `\`${index + 1}.\` **${order.time}** - ${order.name} (📍 Toạ độ: ${order.coords})\n`;
        });

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            const folderLink = `https://drive.google.com/drive/folders/${userFolderId}`;
            const mapLink = `https://www.google.com/maps?q=${coordinates.replace(/\s/g, '')}`;
            const discordMessage = `<@884662992921313352> có file in mới!\n👤 Người nhận: **${userName}**\n📍 Toạ độ: **${coordinates}**\n⏰ Giờ: **${deliveryTime}**\n🗺️ Bản đồ: ${mapLink}\n📁 Link file: ${folderLink}${summaryText}`;
            
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: discordMessage })
            }).catch(console.error);
        }

        res.status(200).json({ status: 'success' });
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

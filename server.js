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

// Hàm tìm hoặc tạo thư mục
async function findOrCreateFolder(folderName, parentId) {
    if (!parentId || parentId.trim() === '') throw new Error("Lỗi: Không tìm thấy ID thư mục cha!");
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
// 1. API MÁY IN (Giữ nguyên)
// ==========================================
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const userName = req.body.fullName || 'Unknown_User';
        const files = req.files;
        const rootFolderId = process.env.DRIVE_PARENT_FOLDER_ID;

        if (!rootFolderId) throw new Error("Cấu hình DRIVE_PARENT_FOLDER_ID bị sai.");
        if (files.length === 0) throw new Error("Không có file nào được gửi lên.");

        const dateString = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
        const dateFolderId = await findOrCreateFolder(dateString, rootFolderId);
        const userFolderId = await findOrCreateFolder(userName, dateFolderId);

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
        res.status(200).json({ message: 'Tải lên thành công!', status: 'success' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==========================================
// 2. API ĐÁM MÂY MINI CHO BẠN BÈ
// ==========================================
app.post('/api/cloud-upload', upload.array('files'), async (req, res) => {
    try {
        const email = req.body.email || '';
        const files = req.files;
        const cloudRootId = process.env.CLOUD_PARENT_FOLDER_ID; // Nhớ thêm biến này trên Render

        if (!cloudRootId) throw new Error("Hệ thống chưa cấu hình CLOUD_PARENT_FOLDER_ID.");
        if (files.length === 0) throw new Error("KhôngDuyệt luôn, triển thôi! 🚀 Mình đã sẵn sàng 100% năng lượng rồi đây. 

Bạn muốn chúng ta tiến hành công việc hay dự án cụ thể nào hôm nay nhỉ?

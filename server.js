const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public')); // Phục vụ file tĩnh (Frontend)
app.use(express.json());

// Cấu hình Multer để lưu file tạm thời
const upload = multer({ dest: 'uploads/' });

// Xác thực Google Drive API bằng Service Account
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth });

// Hàm tìm hoặc tạo thư mục trên Google Drive
async function findOrCreateFolder(folderName, parentId) {
    if (!parentId || parentId.trim() === '') {
        throw new Error("Lỗi: Không tìm thấy ID thư mục cha! Hãy kiểm tra lại biến DRIVE_PARENT_FOLDER_ID trên Render.");
    }
    
    try {
        const query = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${folderName}' and '${parentId}' in parents`;
        const response = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });

        if (response.data.files.length > 0) {
            return response.data.files[0].id; // Đã tồn tại
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
        throw error; // Ném lỗi ra ngoài để API bắt được
    }
}

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const userName = req.body.fullName || 'Unknown_User';
        const coordinates = req.body.coordinates || 'Chưa cung cấp toạ độ';
        const files = req.files;
        const rootFolderId = process.env.DRIVE_PARENT_FOLDER_ID;

        // Bẫy lỗi cấu hình biến môi trường
        if (!rootFolderId || rootFolderId.includes('http')) {
            throw new Error("Cấu hình DRIVE_PARENT_FOLDER_ID bị sai. Chỉ copy mã ID, không được chứa cả đường link https://...");
        }
        if (files.length === 0) {
            throw new Error("Không có file nào được gửi lên.");
        }

        // 1. Lấy ngày hiện tại
        const today = new Date();
        const dateString = `${today.getDate()}/${today.getMonth() + 1}`;

        // 2. Tìm/Tạo thư mục Ngày và thư mục User
        const dateFolderId = await findOrCreateFolder(dateString, rootFolderId);
        const userFolderId = await findOrCreateFolder(userName, dateFolderId);

        // 3. Upload từng file
        const uploadPromises = files.map(async (file) => {
            const fileMetadata = { name: file.originalname, parents: [userFolderId] };
            const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

            const uploadedFile = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            fs.unlinkSync(file.path); // Xóa file tạm
            return uploadedFile.data.id;
        });

        await Promise.all(uploadPromises);

        // ==========================================
        // 4. BẮN THÔNG BÁO VỀ DISCORD WEBHOOK
        // ==========================================
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            const folderLink = `https://drive.google.com/drive/folders/${userFolderId}`;
            const mapLink = `https://www.google.com/maps?q=${coordinates.replace(/\s/g, '')}`;
            
            const discordMessage = `<@884662992921313352> có file để in người nhận là **${userName}** ở **${coordinates}**\n📍 Xem bản đồ: ${mapLink}\n📁 Link tải file: ${folderLink}`;

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
        // Trả lỗi cụ thể về cho người dùng thay vì báo chung chung
        res.status(500).json({ message: error.message || 'Có lỗi xảy ra trong quá trình upload.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Đảm bảo thư mục uploads tồn tại
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
});

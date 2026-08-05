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
        // Xử lý ký tự xuống dòng (\n) trong chuỗi private key trên Render
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth });

// Hàm tìm hoặc tạo thư mục trên Google Drive
async function findOrCreateFolder(folderName, parentId) {
    try {
        // Tìm thư mục có tên cụ thể trong thư mục cha
        const query = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${folderName}' and '${parentId}' in parents`;
        const response = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });

        if (response.data.files.length > 0) {
            return response.data.files[0].id; // Đã tồn tại
        }

        // Nếu chưa có thì tạo mới
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
        console.error('Lỗi khi tạo folder:', error);
        throw error;
    }
}

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const userName = req.body.fullName || 'Unknown_User';
        const files = req.files;
        const rootFolderId = process.env.DRIVE_PARENT_FOLDER_ID;

        // 1. Lấy ngày hiện tại dạng DD/M
        const today = new Date();
        const dateString = `${today.getDate()}/${today.getMonth() + 1}`;

        // 2. Tìm/Tạo thư mục Ngày (Ví dụ: 18/5)
        const dateFolderId = await findOrCreateFolder(dateString, rootFolderId);

        // 3. Tìm/Tạo thư mục Tên Người Dùng (Ví dụ: LE thai quoc)
        const userFolderId = await findOrCreateFolder(userName, dateFolderId);

        // 4. Upload từng file lên thư mục của người dùng
        const uploadPromises = files.map(async (file) => {
            const fileMetadata = {
                name: file.originalname,
                parents: [userFolderId]
            };
            const media = {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path)
            };

            const uploadedFile = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            // 5. Xóa file tạm ở Backend sau khi upload thành công lên Drive
            fs.unlinkSync(file.path);
            return uploadedFile.data.id;
        });

        await Promise.all(uploadPromises);

        res.status(200).json({ message: 'Tải lên thành công!', status: 'success' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Có lỗi xảy ra trong quá trình upload.', error: error.message });
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

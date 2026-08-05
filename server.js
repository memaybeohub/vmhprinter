app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const userName = req.body.fullName || 'Unknown_User';
        const coordinates = req.body.coordinates || 'Chưa cung cấp toạ độ';
        const files = req.files;
        const rootFolderId = process.env.DRIVE_PARENT_FOLDER_ID;

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
            
            // Format tin nhắn đúng yêu cầu của bạn
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
        console.error(error);
        res.status(500).json({ message: 'Có lỗi xảy ra trong quá trình upload.', error: error.message });
    }
});

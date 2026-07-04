import prisma from '../utils/prisma';

export class FolderService {
    static async addFolder(userId: string, folderId: string, folderName: string) {
        // -# para no procesarla de nuevo pero la asociaremos a quien la vincule
        const existingFolder = await prisma.linkedFolder.findUnique({
            where: { folder_id: folderId }
        });

        if (existingFolder) {
            return {
                isNew: false,
                folder: existingFolder
            };
        }

        const newFolder = await prisma.linkedFolder.create({
            data: {
                folder_id: folderId,
                folder_name: folderName,
                userId: userId
            }
        });

        return {
            isNew: true,
            folder: newFolder
        };
    }

    static async getFoldersByUser(userId: string) {
        return await prisma.linkedFolder.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async checkFolderExists(folderId: string) {
        const folder = await prisma.linkedFolder.findUnique({
            where: { folder_id: folderId }
        });
        return folder !== null;
    }
}

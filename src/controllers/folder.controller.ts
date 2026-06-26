import { Request, Response } from 'express';
import { FolderService } from '../services/folder.service';

export const addFolder = async (req: Request, res: Response) => {
    try {
        const { folder_id, folder_name } = req.body;
        // Obtenemos userId del middleware de auth
        const userId = (req as any).user?.userId || (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!folder_id || !folder_name) {
            return res.status(400).json({ error: 'folder_id y folder_name son requeridos' });
        }

        const result = await FolderService.addFolder(userId, folder_id, folder_name);
        
        return res.status(result.isNew ? 201 : 200).json({
            message: result.isNew ? 'Carpeta vinculada exitosamente' : 'La carpeta ya estaba registrada',
            folder: result.folder
        });
    } catch (error) {
        console.error('[FolderController] Error addFolder:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getFolders = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId || (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const folders = await FolderService.getFoldersByUser(userId);
        return res.status(200).json(folders);
    } catch (error) {
        console.error('[FolderController] Error getFolders:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const checkFolder = async (req: Request, res: Response) => {
    try {
        const folder_id = req.params.folder_id as string;
        const exists = await FolderService.checkFolderExists(folder_id);
        return res.status(200).json({ exists });
    } catch (error) {
        console.error('[FolderController] Error checkFolder:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

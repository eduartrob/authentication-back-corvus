import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

export const getUniversities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    
    let universities = [];
    
    // Función auxiliar para normalizar texto (quitar acentos y pasar a minúsculas)
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Obtenemos todas las universidades porque son pocas (aprox 1200) para hacer un filtrado preciso
    const allUniversities = await prisma.university.findMany({
      orderBy: { name: 'asc' }
    });

    if (search && search.length >= 2) {
      const normalizedSearch = normalize(search);
      
      universities = allUniversities.filter(u => {
        const normalizedName = normalize(u.name);
        return normalizedName.includes(normalizedSearch);
      }).slice(0, 30);
    } else {
      universities = allUniversities.slice(0, 30);
    }
    
    res.status(200).json(universities);
  } catch (error) {
    next(error);
  }
};

export const getRegisteredUniversities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const universities = await prisma.university.findMany({
      where: {
        registrationCode: { not: null }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json(universities);
  } catch (error) {
    next(error);
  }
};

export const generateUniversityCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Generar un código alfanumérico aleatorio de 6 caracteres en mayúsculas
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const updatedUniversity = await prisma.university.update({
      where: { id: id as string },
      data: { registrationCode: code }
    });
    
    res.status(200).json({ success: true, university: updatedUniversity });
  } catch (error) {
    next(error);
  }
};

export const validateUniversityCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Código es requerido' });
    }

    const university = await prisma.university.findUnique({
      where: { registrationCode: code.toUpperCase() }
    });

    if (!university) {
      return res.status(404).json({ success: false, message: 'Código de universidad inválido' });
    }

    res.status(200).json({ success: true, university });
  } catch (error) {
    next(error);
  }
};

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

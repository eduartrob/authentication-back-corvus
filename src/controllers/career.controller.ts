import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

export const getCareers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const universityId = req.query.universityId as string;
    
    let queryArgs: any = {
      orderBy: { name: 'asc' },
      where: {}
    };

    if (universityId) {
      if (universityId.includes('-')) {
        queryArgs.where.university_careers = { some: { universityId } };
      } else {
        queryArgs.where.university_careers = {
          some: {
            university: { name: { equals: universityId, mode: 'insensitive' } }
          }
        };
      }
    }

    if (search && search.length >= 2) {
      const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedSearch = normalize(search);
      queryArgs.where.normalized_name = {
        contains: normalizedSearch
      };
    }

    const careers = await prisma.career.findMany(queryArgs);
    res.status(200).json(careers);
  } catch (error) {
    next(error);
  }
};

export const resolveCareer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { careerName } = req.body;
    
    if (!careerName || typeof careerName !== 'string') {
      res.status(400).json({ message: 'El nombre de la carrera es requerido' });
      return;
    }

    const normalizedName = careerName.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Intentar buscar la carrera de forma exacta o semántica (usando similaridad básica por ahora)
    let career = await prisma.career.findFirst({
      where: {
        normalized_name: {
          equals: normalizedName
        }
      },
      include: {
        career_skills: {
          include: {
            skill: true
          }
        }
      }
    });

    if (!career) {
      // Buscar con similitud usando contains
      career = await prisma.career.findFirst({
        where: {
          normalized_name: {
            contains: normalizedName
          }
        },
        include: {
          career_skills: {
            include: {
              skill: true
            }
          }
        }
      });
    }

    if (career && career.career_skills && career.career_skills.length > 0) {
      // Si la encontró y tiene habilidades, retornamos la carrera y sus habilidades formateadas solo como strings
      const skills = career.career_skills.map((cs: any) => cs.skill.name);
      res.status(200).json({ career, skills });
      return;
    }

    // Si NO se encontró, pedimos las habilidades al microservicio llm-back-corvus
    console.log(`🧠 Carrera "${careerName}" no encontrada. Llamando a llm-back-corvus...`);
    
    let generatedSkills: {name: string, weight: number}[] = [];

    try {
      const llmUrl = process.env.LLM_URL || 'http://localhost:3003';
      const response = await fetch(`${llmUrl}/api/v1/llm/generate-career-skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ career_name: careerName, provider: "groq" })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.skills && Array.isArray(data.skills)) {
          generatedSkills = data.skills;
        }
      } else {
        console.error("Error from llm-back-corvus:", await response.text());
      }
    } catch (e) {
      console.error("Error al llamar a llm-back-corvus:", e);
    }

    // Asegurarse de tener elementos
    if (generatedSkills.length === 0) {
      generatedSkills = [
        { name: "Resolución de problemas", weight: 8 },
        { name: "Trabajo en equipo", weight: 7 },
        { name: "Comunicación", weight: 6 },
        { name: "Liderazgo", weight: 6 },
        { name: "Pensamiento crítico", weight: 8 }
      ];
    }

    // Guardar en la DB (Carrera y Skills)
    let newCareer: any = career;
    if (!newCareer) {
      newCareer = await prisma.career.create({
        data: {
          name: careerName,
          normalized_name: normalizedName
        }
      });
    }

    // Crear/buscar habilidades y asociarlas
    for (const skillObj of generatedSkills) {
      const skillName = typeof skillObj === 'string' ? skillObj : skillObj.name;
      const skillWeight = typeof skillObj === 'string' ? 5 : (skillObj.weight || 5);
      
      // Ignorar si el string es muy largo
      if (typeof skillName !== 'string' || skillName.length > 50) continue;
      
      let skill = await prisma.skill.findUnique({ where: { name: skillName.trim() } });
      if (!skill) {
        skill = await prisma.skill.create({ data: { name: skillName.trim() } });
      }

      await prisma.careerSkill.create({
        data: {
          careerId: newCareer.id,
          skillId: skill.id,
          weight: skillWeight
        }
      });
    }

    // Retornar la nueva carrera y sus habilidades solo como strings
    const returnedSkills = generatedSkills.map((s: any) => typeof s === 'string' ? s : s.name);
    res.status(200).json({ career: newCareer, skills: returnedSkills });
    
  } catch (error) {
    next(error);
  }
};

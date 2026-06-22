import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import logger from '../utils/logger';

const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleName: z.enum(['ALUMNO', 'PROFESOR', 'ADMINISTRADOR']),
  username: z.string().optional(),
  fullName: z.string().optional(),
  profilePicture: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleLoginSchema = z.object({
  authCode: z.string(),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const user = await authService.register(validatedData);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const data = await authService.login(validatedData.email, validatedData.password);
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const validatedData = googleLoginSchema.parse(req.body);
      const data = await authService.googleLogin(validatedData.authCode);
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: Request, res: Response) {
      // req.user is set by authMiddleware
      res.status(200).json({ user: (req as any).user });
  }
}

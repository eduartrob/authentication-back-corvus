import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import logger from '../utils/logger';
import crypto from 'crypto';

const authService = new AuthService();
import { rabbitmqService } from '../services/rabbitmq.service';

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
  fcmToken: z.string().optional(),
});

const googleLoginSchema = z.object({
  authCode: z.string(),
  fcmToken: z.string().optional(),
});

const recoverPasswordSchema = z.object({
  email: z.string().email(),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const user = await authService.register(validatedData);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const data = await authService.login(validatedData.email, validatedData.password);
      
      if (validatedData.fcmToken && data.user) {
        rabbitmqService.publishDeviceRegistered(data.user.id, validatedData.fcmToken);
      }
      
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const validatedData = googleLoginSchema.parse(req.body);
      const data = await authService.googleLogin(validatedData.authCode);

      if (validatedData.fcmToken && data.user) {
        rabbitmqService.publishDeviceRegistered(data.user.id, validatedData.fcmToken);
      }

      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: Request, res: Response) {
      res.status(200).json({ user: (req as any).user });
  }

  async logout(req: Request, res: Response) {
    try {
      const { fcmToken } = req.body;
      const user = (req as any).user;

      if (user && fcmToken) {
        rabbitmqService.publishDeviceUnregistered(user.id, fcmToken);
      }
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async recoverPassword(req: Request, res: Response) {
    try {
      const validatedData = recoverPasswordSchema.parse(req.body);
      

      // -# 1 generar pin criptograficamente seguro de 6 digitos
      const securePin = crypto.randomInt(100000, 999999).toString();

      rabbitmqService.publishPasswordRecovery("user-id", validatedData.email, securePin);

      res.status(200).json({ 
        message: 'Si el correo existe, se ha enviado un PIN de recuperación.',
        _test_pin: securePin 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}

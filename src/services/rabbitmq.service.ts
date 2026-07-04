import * as amqp from 'amqplib';
import type { Connection, Channel } from 'amqplib';

class RabbitMQService {
  private connection!: Connection;
  private channel!: Channel;
  private readonly URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  private readonly EXCHANGE = 'corvus_events';

  async connect() {
    try {
      this.connection = (await amqp.connect(this.URL)) as any;
      this.channel = await (this.connection as any).createChannel();
      
      await this.channel.assertExchange(this.EXCHANGE, 'topic', { durable: true });
      console.log('✅ Conectado a RabbitMQ (Autenticación)');
    } catch (error) {
      console.error('❌ Error conectando a RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publishDeviceRegistered(userId: string, fcmToken: string) {
    if (!this.channel) return;
    const payload = { userId, fcmToken, timestamp: new Date() };
    this.channel.publish(
      this.EXCHANGE,
      'auth.device.registered',
      Buffer.from(JSON.stringify(payload))
    );
    console.log(`📤 Evento publicado: auth.device.registered para User ${userId}`);
  }

  async publishDeviceUnregistered(userId: string, fcmToken: string) {
    if (!this.channel) return;
    const payload = { userId, fcmToken, timestamp: new Date() };
    this.channel.publish(
      this.EXCHANGE,
      'auth.device.unregistered',
      Buffer.from(JSON.stringify(payload))
    );
    console.log(`📤 Evento publicado: auth.device.unregistered para User ${userId}`);
  }

  async publishPasswordRecovery(userId: string, email: string, token: string) {
    if (!this.channel) return;
    const payload = { userId, email, recovery_token: token, timestamp: new Date() };
    this.channel.publish(
      this.EXCHANGE,
      'auth.password_recovery.requested',
      Buffer.from(JSON.stringify(payload))
    );
    console.log(`📤 Evento publicado: auth.password_recovery.requested para ${email}`);
  }
}

export const rabbitmqService = new RabbitMQService();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración CORS más flexible para Vercel
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3001',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      // Permitir localhost
      if (allowedOrigins.includes(origin)) return callback(null, true);
      
      // Permitir cualquier subdominio de vercel.app
      if (origin.includes('.vercel.app')) return callback(null, true);
      
      // Permitir cualquier subdominio de oscars-projects-549aeb9c.vercel.app
      if (origin.includes('oscars-projects-549aeb9c.vercel.app')) return callback(null, true);
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      skipMissingProperties: false,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validateCustomDecorators: true,
    }),
  );

  await app.listen(process.env.PORT || 3001);
  console.log('🚀 Backend running on port:', process.env.PORT || 3001);
}
bootstrap();

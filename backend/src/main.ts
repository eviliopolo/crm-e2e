import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { CrmValidationPipe } from './config/crm-validation.pipe';
import {
  mepBodyParserErrorHandler,
  mepJsonBodyParser,
} from './modules/mep-integration/middleware/mep-body-limit';
import { MEP_CONTRACT_ROUTES } from './modules/mep-integration/mep-contract-routes';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigins = (configService.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      maxAge: 86_400,
    });
  }

  app.useWebSocketAdapter(new IoAdapter(app));

  const yamlHeaders = {
    setHeaders: (res: { setHeader: (name: string, value: string) => void }, filePath: string) => {
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
      }
    },
  };

  app.useStaticAssets(join(__dirname, '..', 'public'), yamlHeaders);

  const repoOpenApiDir = join(__dirname, '..', '..', 'openapi');
  if (existsSync(join(repoOpenApiDir, 'crm-mep.yaml'))) {
    app.useStaticAssets(repoOpenApiDir, { prefix: '/openapi', ...yamlHeaders });
  }


  // §10.3 — el contrato CRM ↔ MEP-LEAN admite cuerpos de hasta 256 KB. Su
  // parser se monta solo sobre `/v1` y antes que el de Nest, que a partir de
  // ahí no vuelve a procesar el cuerpo: el resto del CRM conserva su límite.
  // El manejador de error traduce el 413 del parser a `problem+json` (§5.4).
  app.use('/v1', mepJsonBodyParser());
  app.use(mepBodyParserErrorHandler());

  // Las 6 operaciones del contrato viven en `/v1` (SPEC-CRM-MEPLEAN-001 §Base
  // path); el resto del CRM conserva `api/v1`.
  app.setGlobalPrefix('api/v1', {
    exclude: MEP_CONTRACT_ROUTES.map((path) => ({
      path,
      method: RequestMethod.ALL,
    })),
  });

  app.useGlobalPipes(new CrmValidationPipe());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();

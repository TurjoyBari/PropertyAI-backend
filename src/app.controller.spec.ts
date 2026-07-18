import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { ConnectionStates } from 'mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getConnectionToken(),
          useValue: {
            readyState: ConnectionStates.connected,
            name: 'propertyai',
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API root payload', () => {
      expect(appController.getRoot()).toEqual(
        expect.objectContaining({
          name: 'PropertyAI API',
          status: 'ok',
        }),
      );
    });
  });

  describe('health', () => {
    it('should return health payload with database status', () => {
      expect(appController.getHealth()).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'propertyai-backend',
          database: {
            status: 'connected',
            name: 'propertyai',
          },
        }),
      );
    });
  });
});

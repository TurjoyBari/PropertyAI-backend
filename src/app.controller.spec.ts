import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
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
    it('should return health payload', () => {
      expect(appController.getHealth()).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'propertyai-backend',
        }),
      );
    });
  });
});

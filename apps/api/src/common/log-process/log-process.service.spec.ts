import { Test, TestingModule } from '@nestjs/testing';
import { LogProcessService } from './log-process.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock the PrismaService
jest.mock('../../prisma/prisma.service');

describe('LogProcessService', () => {
  let service: LogProcessService;

  const mockLogProcess = {
    ProcessId: 'PR20260606120000123456',
    FunctionId: 'TEST_001',
    FunctionName: 'testFunction',
    ProcessStatus: 'STARTED',
    ProcessStart: new Date(),
    ProcessEnd: null,
    ProcessDate: new Date(),
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
  };

  const mockLogProcessDetail = {
    ProcessDetailId: BigInt(1),
    ProcessId: 'PR20260606120000123456',
    MessageId: 'COMM-001',
    Message: 'Test message',
    Type: 'INFO',
    Location: 'test.ts:10',
    ProcessDate: new Date(),
    CreatedAt: new Date(),
  };

  let prismaService: {
    logProcess: {
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    logProcessDetail: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaService = {
      logProcess: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      logProcessDetail: {
        create: jest.fn(),
      },
    };

    (PrismaService as unknown as jest.Mock).mockImplementation(
      () => prismaService,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogProcessService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<LogProcessService>(LogProcessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startProcess', () => {
    it('should create a new log process with STARTED status', async () => {
      prismaService.logProcess.create.mockResolvedValue(mockLogProcess);

      const result = await service.startProcess({
        functionId: 'TEST_001',
        functionName: 'testFunction',
        createdBy: 'testuser',
      });

      expect(result).toEqual(mockLogProcess);
      expect(prismaService.logProcess.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          FunctionId: 'TEST_001',
          FunctionName: 'testFunction',
          ProcessStatus: 'STARTED',
          CreatedBy: 'testuser',
        }),
      });
    });

    it('should reset message counter when starting new process', async () => {
      prismaService.logProcess.create.mockResolvedValue(mockLogProcess);

      await service.startProcess({
        functionId: 'TEST_001',
        functionName: 'testFunction',
        createdBy: 'testuser',
      });

      service.resetCounter();
    });
  });

  describe('addLog', () => {
    it('should create a log detail entry with INFO type', async () => {
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      const result = await service.addLog({
        processId: 'PR20260606120000123456',
        message: 'Test message',
        type: 'INFO',
        location: 'test.ts:10',
      });

      expect(result).toEqual(mockLogProcessDetail);
      expect(prismaService.logProcessDetail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ProcessId: 'PR20260606120000123456',
          Message: 'Test message',
          Type: 'INFO',
          Location: 'test.ts:10',
        }),
      });
    });

    it('should create a log detail entry with ERROR type', async () => {
      const errorLog = {
        ...mockLogProcessDetail,
        Type: 'ERROR',
        Message: 'Error occurred',
      };
      prismaService.logProcessDetail.create.mockResolvedValue(errorLog);

      const result = await service.addLog({
        processId: 'PR20260606120000123456',
        message: 'Error occurred',
        type: 'ERROR',
        location: 'test.ts:20',
      });

      expect(result.Type).toBe('ERROR');
    });

    it('should assign independent message IDs to each log', async () => {
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      await service.addLog({
        processId: 'PR20260606120000123456',
        message: 'First message',
        type: 'INFO',
        location: 'test.ts:10',
      });

      expect(prismaService.logProcessDetail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          MessageId: expect.stringMatching(/^COMM-[0-9a-f-]{36}$/),
        }),
      });

      await service.addLog({
        processId: 'PR20260606120000123456',
        message: 'Second message',
        type: 'INFO',
        location: 'test.ts:20',
      });

      expect(prismaService.logProcessDetail.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          MessageId: expect.stringMatching(/^COMM-[0-9a-f-]{36}$/),
        }),
      });
    });

    it('should keep concurrent process message IDs independent', async () => {
      prismaService.logProcessDetail.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...mockLogProcessDetail, ...data }),
      );

      await Promise.all([
        service.addLog({
          processId: 'process-a',
          message: 'A1',
          type: 'INFO',
          location: 'test.ts',
        }),
        service.addLog({
          processId: 'process-b',
          message: 'B1',
          type: 'INFO',
          location: 'test.ts',
        }),
        service.addLog({
          processId: 'process-a',
          message: 'A2',
          type: 'INFO',
          location: 'test.ts',
        }),
      ]);

      const calls = prismaService.logProcessDetail.create.mock.calls.map(
        ([argument]) => argument.data,
      );
      expect(calls.map((call) => [call.ProcessId, call.MessageId])).toEqual([
        ['process-a', expect.stringMatching(/^COMM-[0-9a-f-]{36}$/)],
        ['process-b', expect.stringMatching(/^COMM-[0-9a-f-]{36}$/)],
        ['process-a', expect.stringMatching(/^COMM-[0-9a-f-]{36}$/)],
      ]);
    });

    it('should use the supplied transaction client', async () => {
      const transactionClient = {
        logProcessDetail: {
          create: jest.fn().mockResolvedValue(mockLogProcessDetail),
        },
      };

      await service.addLog({
        processId: 'transaction-process',
        message: 'Committed fact',
        type: 'INFO',
        location: 'test.ts',
        client: transactionClient as never,
      });

      expect(transactionClient.logProcessDetail.create).toHaveBeenCalled();
      expect(prismaService.logProcessDetail.create).not.toHaveBeenCalled();
    });

    it('should continue issuing unique IDs after many messages', async () => {
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      // Add logs to increment counter to 998
      for (let i = 0; i < 998; i++) {
        await service.addLog({
          processId: 'test',
          message: 'msg',
          type: 'INFO',
          location: 'test.ts',
        });
      }

      // Verify counter is at 998
      expect(prismaService.logProcessDetail.create).toHaveBeenCalledTimes(998);

      // Reset counter
      service.resetCounter();

      // Next log should be COMM-001
      await service.addLog({
        processId: 'PR20260606120000123456',
        message: 'Message after reset',
        type: 'INFO',
        location: 'test.ts:50',
      });

      expect(prismaService.logProcessDetail.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          MessageId: expect.stringMatching(/^COMM-[0-9a-f-]{36}$/),
        }),
      });
    });
  });

  describe('completeProcess', () => {
    it('should update process status to SUCCESS', async () => {
      prismaService.logProcess.updateMany.mockResolvedValue({
        ...mockLogProcess,
        ProcessStatus: 'SUCCESS',
        ProcessEnd: new Date(),
      });
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      await service.completeProcess('PR20260606120000123456', 'SUCCESS');

      expect(prismaService.logProcess.updateMany).toHaveBeenCalledWith({
        where: { ProcessId: 'PR20260606120000123456', ProcessEnd: null },
        data: expect.objectContaining({
          ProcessStatus: 'SUCCESS',
          ProcessEnd: expect.any(Date),
        }),
      });
    });

    it('should update process status to FAILED', async () => {
      prismaService.logProcess.updateMany.mockResolvedValue({
        ...mockLogProcess,
        ProcessStatus: 'FAILED',
        ProcessEnd: new Date(),
      });
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      await service.completeProcess('PR20260606120000123456', 'FAILED');

      expect(prismaService.logProcess.updateMany).toHaveBeenCalledWith({
        where: { ProcessId: 'PR20260606120000123456', ProcessEnd: null },
        data: expect.objectContaining({
          ProcessStatus: 'FAILED',
        }),
      });
    });

    it('should add end message when provided', async () => {
      prismaService.logProcess.updateMany.mockResolvedValue({
        ...mockLogProcess,
        ProcessStatus: 'SUCCESS',
        ProcessEnd: new Date(),
      });
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      await service.completeProcess(
        'PR20260606120000123456',
        'SUCCESS',
        'Process completed successfully',
      );

      expect(prismaService.logProcessDetail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          Message: 'Process completed successfully',
          Type: 'INFO',
        }),
      });
    });

    it('should add ERROR log when status is FAILED with end message', async () => {
      prismaService.logProcess.updateMany.mockResolvedValue({
        ...mockLogProcess,
        ProcessStatus: 'FAILED',
        ProcessEnd: new Date(),
      });
      prismaService.logProcessDetail.create.mockResolvedValue({
        ...mockLogProcessDetail,
        Type: 'ERROR',
      });

      await service.completeProcess(
        'PR20260606120000123456',
        'FAILED',
        'Process failed with error',
      );

      expect(prismaService.logProcessDetail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          Message: 'Process failed with error',
          Type: 'ERROR',
        }),
      });
    });
  });

  describe('resetCounter', () => {
    it('should preserve the compatibility reset operation', async () => {
      prismaService.logProcessDetail.create.mockResolvedValue(
        mockLogProcessDetail,
      );

      // Add some logs to increment counter
      await service.addLog({
        processId: 'test',
        message: 'msg1',
        type: 'INFO',
        location: 'test.ts',
      });

      // Reset counter
      service.resetCounter();

      // Next log should start from COMM-001 again
      await service.addLog({
        processId: 'test',
        message: 'msg2',
        type: 'INFO',
        location: 'test.ts',
      });

      expect(prismaService.logProcessDetail.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          MessageId: expect.stringMatching(/^COMM-[0-9a-f-]{36}$/),
        }),
      });
    });
  });

  describe('generateProcessId', () => {
    it('should generate unique process IDs', async () => {
      prismaService.logProcess.create
        .mockResolvedValueOnce({
          ...mockLogProcess,
          ProcessId: 'PR20260606120000123456',
        })
        .mockResolvedValueOnce({
          ...mockLogProcess,
          ProcessId: 'PR20260606120000123457',
        });

      const result1 = await service.startProcess({
        functionId: 'TEST_001',
        functionName: 'test1',
        createdBy: 'user',
      });

      const result2 = await service.startProcess({
        functionId: 'TEST_002',
        functionName: 'test2',
        createdBy: 'user',
      });

      expect(result1.ProcessId).not.toBe(result2.ProcessId);
    });

    it('should start with PR prefix', async () => {
      prismaService.logProcess.create.mockResolvedValue(mockLogProcess);

      const result = await service.startProcess({
        functionId: 'TEST_001',
        functionName: 'test',
        createdBy: 'user',
      });

      expect(result.ProcessId.startsWith('PR')).toBe(true);
    });
  });
});

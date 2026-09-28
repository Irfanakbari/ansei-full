import { PrintAgentController } from './print-agent.controller';
import { PrintAgentService } from './print-agent.service';

describe('PrintAgentController', () => {
  const service = {
    findAllAgents: jest.fn(),
    findOneAgent: jest.fn(),
  };
  const controller = new PrintAgentController(
    service as unknown as PrintAgentService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated print agent list', async () => {
    const query = {
      page: 2,
      limit: 10,
      search: 'line',
      status: 'ACTIVE' as const,
    };
    const expected = {
      data: [],
      meta: { page: 2, limit: 10, totalItems: 0, totalPages: 0 },
    };
    service.findAllAgents.mockResolvedValue(expected);

    await expect(controller.findAll(query)).resolves.toEqual(expected);
    expect(service.findAllAgents).toHaveBeenCalledWith(query);
  });

  it('returns print agent details', async () => {
    const expected = { Id: 'agent-1', profileCount: 0 };
    service.findOneAgent.mockResolvedValue(expected);

    await expect(controller.findOne('agent-1')).resolves.toEqual(expected);
    expect(service.findOneAgent).toHaveBeenCalledWith('agent-1');
  });
});

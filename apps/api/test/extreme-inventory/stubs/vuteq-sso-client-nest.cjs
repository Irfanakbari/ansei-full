/* By Irfan Akbari Vuteq Indonesia - 2026-09-24 */
class VuteqSsoService {
  async metadata() {
    return {};
  }

  async authenticate() {
    throw new Error('The external SSO SDK is disabled in extreme E2E tests.');
  }
}

module.exports = { VuteqSsoService };

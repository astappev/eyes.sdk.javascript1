'use strict';

class EyesRunner {
  constructor() {
    /** @type {Eyes[]} */
    this._eyesInstances = [];
  }

  // noinspection JSMethodCanBeStatic
  /**
   * @abstract
   * @param {boolean} [shouldThrowException=true]
   * @return {Promise<TestResultsSummary>}
   */
  async getAllTestResults(shouldThrowException) { // eslint-disable-line no-unused-vars
    throw new TypeError('The method is not implemented!');
  }

  /**
   * @protected
   * @return {Promise<void>}
   */
  async _closeAllBatches() {
    if (this._eyesInstances.length > 0) {
      const batchIds = new Set();
      for (const eyesInstance of this._eyesInstances) {
        const batchId = eyesInstance.getBatch().getId();
        if (!batchIds.has(batchId)) {
          batchIds.add(batchId);
        }
      }

      const promises = Array.from(batchIds).map(batchId => this._eyesInstances[0]._serverConnector.deleteBatchSessions(batchId));
      await Promise.all(promises);
    }
  }
}

exports.EyesRunner = EyesRunner;

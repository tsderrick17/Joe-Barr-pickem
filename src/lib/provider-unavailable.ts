/**
 * A data provider (ESPN, the Odds API) could not be read, so the run could not do its job. Thrown instead of returning "nothing found", so the
 * automation records the run as failed with the reason, rather than as a success that quietly did nothing.
 */
export class ProviderUnavailable extends Error {
  constructor(readonly provider: string, message: string) {
    super(message);
    this.name = "ProviderUnavailable";
  }
}

export interface DeploymentParameters {
  environment: string;
  bucket: string;
  indexPath: string;
  routingDomain: string;
  spaNotFoundPath: string;
  stack: string;
}

import * as cdk from "@aws-cdk/core";
import * as cinc from "@aws-cdk/cloudformation-include";
import * as path from "path";

export interface ServiceDefinition {
  name: string;
  templatePath: string;
  loadNestedStacks: {
    [stackName: string]: cinc.CfnIncludeProps;
  };
  parameters: Record<string, string>;
}

class ServiceStack extends cdk.Stack {
  public readonly included: cinc.CfnInclude;

  constructor(scope: cdk.Construct, id: string, props: ServiceProps) {
    super(scope, id);

    const { service } = props;

    this.included = new cinc.CfnInclude(this, "include", {
      templateFile: path.join(process.cwd(), service.templatePath),
      parameters: service.parameters,
      loadNestedStacks: service.loadNestedStacks,
    });
  }
}

export interface ServiceProps {
  service: ServiceDefinition;
}

export class Service extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ServiceProps) {
    super(scope, id);
    new ServiceStack(this, props.service.name, props);
  }
}

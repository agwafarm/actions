import * as cdk from "@aws-cdk/core";
import * as cinc from "@aws-cdk/cloudformation-include";

export interface ServiceDefinition {
  stackName: string;
  templatePath: string;
  loadNestedStacks: {
    [stackName: string]: cinc.CfnIncludeProps;
  };
  parameters: Record<string, string>;
}

export interface ServiceProps {
  service: ServiceDefinition;
}

export class Service extends cdk.Stack {
  public readonly included: cinc.CfnInclude;

  constructor(scope: cdk.Construct, id: string, props: ServiceProps) {
    super(scope, id);

    const { service } = props;

    this.included = new cinc.CfnInclude(this, "Include", {
      templateFile: service.templatePath,
      parameters: service.parameters,
      loadNestedStacks: service.loadNestedStacks,
      preserveLogicalIds: true,
    });
  }
}

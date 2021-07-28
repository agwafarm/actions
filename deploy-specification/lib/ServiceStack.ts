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

export interface ServiceStackProps extends cdk.StackProps {
  service: ServiceDefinition;
}

export class ServiceStack extends cdk.Stack {
  public readonly included: cinc.CfnInclude;

  constructor(scope: cdk.Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const { service } = props;

    this.included = new cinc.CfnInclude(this, "include", {
      templateFile: path.join(process.cwd(), service.templatePath),
      parameters: service.parameters,
      loadNestedStacks: service.loadNestedStacks,
    });
  }
}

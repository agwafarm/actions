import * as cdk from "aws-cdk-lib";
import * as cinc from "aws-cdk-lib/cloudformation-include";
import { Construct } from "constructs";

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

  constructor(scope: Construct, id: string, props: ServiceProps) {
    super(scope, id, {
      // Prevent CDK from adding Parameters.BootstrapVersion and the rule
      synthesizer: new cdk.DefaultStackSynthesizer({
        generateBootstrapVersionRule: false,
      }),
    });

    const { service } = props;

    this.included = new cinc.CfnInclude(this, "Include", {
      templateFile: service.templatePath,
      parameters: service.parameters,
      loadNestedStacks: service.loadNestedStacks,
      preserveLogicalIds: true,
    });
  }
}

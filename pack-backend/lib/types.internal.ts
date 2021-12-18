import { Resources } from "./Resources";
import { LambdaLayerProps, LambdaProps, ServiceLambdasProps } from "./types";

export interface LambdasProps extends ServiceLambdasProps {
   /**
    * Lambda definitions
    */
   lambdas?: LambdaProps[];

   /**
    * Creates all functions with the specified layers
    */
   layers?: LambdaLayerProps[];

   /**
    * Buckets reference
    */
   resources: Resources;
}

import * as path from "path";
import * as fs from "fs";
import * as lambda from "@aws-cdk/aws-lambda";
import { LambdaConfig, LambdaLayerProps, LambdaProps } from "./types";

const lambdaHandlerRegex = /^handler\.py$/;

const extractLambdaProps = (options: {
   folderPath: string;
   folderName: string;
}): LambdaProps | undefined => {
   let { folderName, folderPath } = options;
   const functionName = folderName;

   const fileName = fs
      .readdirSync(path.join(folderPath, "app"))
      .find((file) => file.match(lambdaHandlerRegex));
   if (!fileName) {
      throw new Error(
         `function folder contains no handler file: ${folderPath}`
      );
   }

   const configFilePath = path.join(folderPath, "handler.config.ts");

   if (!fs.existsSync(configFilePath)) {
      throw new Error(
         `function folder contains no configuration file: ${folderPath}`
      );
   }

   const config: LambdaConfig = require(configFilePath).config;

   const layerFolderPath = path.join(folderPath, "requirements.txt");

   const layers: LambdaLayerProps[] = [];
   if (fs.existsSync(layerFolderPath)) {
      layers.push({
         name: functionName,
      });
   }

   return {
      functionName,
      handler: `app.handler.handler`,
      runtime: lambda.Runtime.PYTHON_3_8,
      config,
      layers,
   };
};

export const getLambdaProps = (rootFolders: string[]): LambdaProps[] =>
   rootFolders
      .flatMap((rootFolder) =>
         fs
            .readdirSync(rootFolder)
            .map((folderName) => ({
               folderPath: path.join(rootFolder, folderName),
               folderName,
            }))
            .filter(({ folderPath }) => fs.statSync(folderPath).isDirectory())
      )
      .map(extractLambdaProps)
      .filter((item) => !!item) as LambdaProps[];

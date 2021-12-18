#!/bin/bash
set -e
set -u
set -o pipefail

current_folder=/github/workspace
cd $current_folder
common_layer_path=artifacts/layers/common
asset_name=asset.zip

# Create and Upload Lambda & Layer Assets
mkdir -p $common_layer_path
common_layer_target_path=$common_layer_path/python
python3 -m pip install -q -r requirements.txt --target $common_layer_target_path

# Copy local common files to layer before zipping
if [ -d "src/common" ]; then
   cp -r src/common $common_layer_target_path
fi

# Cloud Common Dependencies Lambda Layer
cd $common_layer_path
zip -q -r $asset_name .
aws s3 cp $asset_name $S3_PATH_BASE/layers/cloud-common.zip
cd $current_folder

for d in src/lambdas/*/; do
   func_name=$(basename "$"$d"")
   func_path=src/lambdas/${func_name}
   func_artifact_folder=artifacts/lambdas/${func_name}
   func_s3_key=$S3_PATH_BASE/functions/${func_name}.zip
   req_path=src/lambdas/${func_name}/requirements.txt
   layer_path=artifacts/layers/lambdas/${func_name}
   layer_s3_key=$S3_PATH_BASE/layers/${func_name}.zip

   cd $current_folder
   mkdir -p $func_artifact_folder

   #Lambda has specific dependencies
   if [ -f $req_path ]; then
      mkdir -p $layer_path
      target_path=$layer_path/python
      python3 -m pip install -q -r $req_path --target $target_path
      cd $layer_path
      zip -q -r $asset_name .
      aws s3 cp $asset_name $layer_s3_key
      cd $current_folder
   fi

   cd $func_path
   zip -q -r $asset_name .
   aws s3 cp $asset_name $func_s3_key
   cd $current_folder
done

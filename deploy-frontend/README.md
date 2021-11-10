packing must be done per env, since the url for the backend is injected during build (e.g. asset generation e.g. packing).

we do not copy to low storage prefix - we simply deploy the frontend to the environment using cdk.
for the standard storage prefix- we also deploy using cdk, but we also update the rc-pointer, copy into the storage+service+version prefix under the assets folder.
we then synth the cdk into yaml using the same flow as in pack.


deploy-specification will be added a pre deployment script which will place the version's assets in the env specific bucket BEFORE deployment of the version.

update rc candidate will also receive application type (frontend / backend and add this as a tag on the ssm variable)
sign version will append this info to each version spec so that pre deployment script will know which frontends to handle

deployment of frontends will have different parameters. spec will return them in the frontends array, not inside services
git push --force # Actions

## Update current version

To update current version one should run the following (push a tag):
`$1` should be the name of the new version to release.
```
git push --delete origin $1
git tag -f $1
git push origin $1
```
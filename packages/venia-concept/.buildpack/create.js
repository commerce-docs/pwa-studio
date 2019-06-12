const { resolve } = require('path');
function createProjectFromVenia(fse) {
    const gitIgnoredGlob = fse
        .readFileSync(resolve(__dirname, '../.gitignore'), 'utf-8')
        .trim()
        .split('\n')
        .join(',');
    const allIgnoredGlob = `{CHANGELOG*,LICENSE*,.buildpack/*,${gitIgnoredGlob}}`;
    const toCopyFromPackageJson = [
        'main',
        'browser',
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'engines'
    ];
    const scriptsToCopy = [
        'build',
        'build:analyze',
        'build:prod',
        'buildpack',
        'clean',
        'download-schema',
        'lint',
        'prettier',
        'prettier:check',
        'prettier:fix',
        'start',
        'start:debug',
        'test',
        'validate-queries',
        'watch'
    ];
    return {
        after({ options }) {
            fse.writeFileSync(
                resolve(options.directory, 'babel.config.js'),
                "module.exports = { presets: ['@magento/peregrine'] };\n",
                'utf8'
            );
        },
        visitor: {
            'package.json': ({
                path,
                targetPath,
                options: { name, author, npmClient }
            }) => {
                const pkgTpt = fse.readJsonSync(path);
                const pkg = {
                    name,
                    version: '0.0.1',
                    description:
                        'A new project based on @magento/venia-concept',
                    author,
                    scripts: {}
                };
                toCopyFromPackageJson.forEach(prop => {
                    pkg[prop] = pkgTpt[prop];
                });

                const toPackageScript =
                    npmClient === 'yarn'
                        ? name => pkgTpt.scripts[name]
                        : name =>
                              pkgTpt.scripts[name].replace(
                                  /yarn run/g,
                                  'npm run'
                              );
                scriptsToCopy.forEach(name => {
                    pkg.scripts[name] = toPackageScript(name);
                });

                if (process.env.DEBUG_PROJECT_CREATION) {
                    console.warn(
                        'process.env.DEBUG_PROJECT_CREATION is true, so we will assume we are inside the pwa-studio repo and replace those package dependency declarations with local file paths.'
                    );
                    const workspaceDir = resolve(__dirname, '../../');
                    fse.readdirSync(workspaceDir).forEach(packageDir => {
                        const packagePath = resolve(workspaceDir, packageDir);
                        if (!fse.statSync(packagePath).isDirectory()) {
                            return;
                        }
                        let name;
                        try {
                            name = fse.readJsonSync(
                                resolve(packagePath, 'package.json')
                            ).name;
                        } catch (e) {}
                        if (!name) {
                            return;
                        }
                        [
                            'dependencies',
                            'devDependencies',
                            'optionalDependencies'
                        ].forEach(depType => {
                            if (pkg[depType][name]) {
                                const localDep = `file://${resolve(
                                    packagePath
                                )}`;
                                pkg[depType][name] = localDep;
                                if (!pkg.resolutions) {
                                    pkg.resolutions = {};
                                }
                                pkg.resolutions[name] = localDep;
                            }
                        });
                    });
                }

                fse.writeJsonSync(targetPath, pkg, {
                    spaces: 2
                });
            },
            'package-lock.json': ({
                path,
                targetPath,
                options: { npmClient }
            }) => {
                if (npmClient === 'npm') {
                    fse.copyFileSync(path, targetPath);
                }
            },
            'yarn.lock': ({ path, targetPath, options: { npmClient } }) => {
                if (npmClient === 'yarn') {
                    fse.copyFileSync(path, targetPath);
                }
            },
            [allIgnoredGlob]: () => {
                return;
            },
            '**/*': ({ stats, path, targetPath }) => {
                if (stats.isDirectory()) {
                    fse.ensureDirSync(targetPath);
                } else {
                    fse.copyFileSync(path, targetPath);
                }
            }
        }
    };
}

module.exports = createProjectFromVenia;
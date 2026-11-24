// ONNX Runtime 1.24.3 still installs JSI through RCTBridge on iOS. SDK 55
// has no bridge. Keep this pinned compatibility patch reproducible under CNG.
const fs = require('node:fs')
const path = require('node:path')
const { withDangerousMod } = require('@expo/config-plugins')

function packageRoot(projectRoot) {
  const file = require.resolve('onnxruntime-react-native/package.json', { paths: [projectRoot] })
  if (JSON.parse(fs.readFileSync(file, 'utf8')).version !== '1.24.3') throw new Error('Review the ONNX new-architecture patch before upgrading ONNX Runtime')
  return path.dirname(file)
}

module.exports = function withOnnxNewArchitecture(config) {
  config = withDangerousMod(config, ['android', cfg => {
    const file = path.join(packageRoot(cfg.modRequest.projectRoot), 'android/src/main/java/ai/onnxruntime/reactnative/OnnxruntimeModule.java')
    const source = fs.readFileSync(file, 'utf8')
    const old = 'getReactApplicationContext().getCatalystInstance().getJSCallInvokerHolder()'
    const next = 'getReactApplicationContext().getJSCallInvokerHolder()'
    if (!source.includes(old) && !source.includes(next)) throw new Error('ONNX Android installation method changed')
    fs.writeFileSync(file, source.replace(old, next))
    const gradleFile = path.join(packageRoot(cfg.modRequest.projectRoot), 'android/build.gradle')
    const gradle = fs.readFileSync(gradleFile, 'utf8')
    // Gradle 9 removed VersionNumber. The package already computes the RN minor.
    const comparison = 'VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")'
    if (!gradle.includes(comparison) && !gradle.includes('REACT_NATIVE_MINOR_VERSION < 71')) throw new Error('ONNX Gradle version check changed')
    fs.writeFileSync(gradleFile, gradle.replace(comparison, 'REACT_NATIVE_MINOR_VERSION < 71')
      .replaceAll('onnxruntime-android:latest.integration@aar', 'onnxruntime-android:1.24.3@aar'))
    return cfg
  }])
  return withDangerousMod(config, ['ios', cfg => {
    const root = packageRoot(cfg.modRequest.projectRoot)
    const header = path.join(root, 'ios/OnnxruntimeModule.h')
    let source = fs.readFileSync(header, 'utf8')
    if (!source.includes('RCTTurboModuleWithJSIBindings')) {
      if (!source.includes('NSObject <RCTBridgeModule>')) throw new Error('ONNX iOS module declaration changed')
      source = source.replace('#import <React/RCTBridgeModule.h>', '#import <React/RCTBridgeModule.h>\n#import <ReactCommon/RCTTurboModule.h>\n#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>')
        .replace('NSObject <RCTBridgeModule>', 'NSObject <RCTBridgeModule, RCTTurboModule, RCTTurboModuleWithJSIBindings>')
      fs.writeFileSync(header, source)
    }
    const implementation = path.join(root, 'ios/OnnxruntimeModule.mm')
    source = fs.readFileSync(implementation, 'utf8')
    if (!source.includes('installJSIBindingsWithRuntime:')) {
      if (!source.includes('RCTCxxBridge* cxxBridge')) throw new Error('ONNX iOS installation method changed')
      fs.writeFileSync(implementation, `// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// LVM SDK 55 compatibility: receive runtime and call invoker from TurboModuleManager.
#import "OnnxruntimeModule.h"
#import <ReactCommon/RCTInteropTurboModule.h>
#include "JsiMain.h"

@implementation OnnxruntimeModule
static std::shared_ptr<onnxruntimejsi::Env> env;
RCT_EXPORT_MODULE(Onnxruntime)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::ObjCInteropTurboModule>(params);
}

- (void)installJSIBindingsWithRuntime:(facebook::jsi::Runtime &)runtime
                        callInvoker:(const std::shared_ptr<facebook::react::CallInvoker> &)invoker {
  env = onnxruntimejsi::install(runtime, invoker);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) { return @(env != nullptr); }
- (void)dealloc { env.reset(); }
@end
`)
    }
    return cfg
  }])
}

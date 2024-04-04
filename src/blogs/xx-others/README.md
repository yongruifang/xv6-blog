---
title: 其他
icon: lightbulb
---
## 参考
官方文档: [6.828](https://pdos.csail.mit.edu/6.828/2020/labs/)
- 参考博客：
	1. [xv6.dgs.zone](https://xv6.dgs.zone/labs/answers/lab1.html)
	2. [miigon](https://blog.miigon.net/tags/operating-system/)
  3. [解析Ta](https://blog.csdn.net/u013577996/article/details/108679997)
- 环境: Ubuntu
- 依赖:
```bash 
apt-get install git build-essential gdb-multiarch qemu-system-misc gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu
```

## 官方仓库克隆
```bash 
git clone git://g.csail.mit.edu/xv6-labs-2020
```

## qemu的手动编译安装
```bash 
apt-get install pkg-config libglib2.0-dev libpixman-1-dev
# apt-cache search 是个好东西
wget https://download.qemu.org/qemu-5.1.0.tar.xz
tar xf qemu-5.1.0.tar.xz 
cd qemu-5.1.0
./configure --disable-kvm --disable-werror --prefix=/usr/local --target-list="riscv64-softmmu"
make 
make install
```

## gdb的运行
```bash 
# /root/.config/gdb/gdbinit
# set auto-load safe-path /
# 终端1
make qemu-gdb
# 终端2 
gdb-multiarch
```

## 代码格式化

::: code-tabs#shell 
@tab compile_flags.txt 
```txt 
-nostdinc
-fno-pic
-static
-fno-builtin
-fno-strict-aliasing
-O0
-g
-Wall
-MD
-gdwarf-2
-m32
-Werror
-fno-omit-frame-pointer
-ggdb
-I.
-fno-stack-protector
```
@tab .clang-format
```yaml
---
Language:      Cpp
BasedOnStyle:  LLVM
AccessModifierOffset: -2
AlignAfterOpenBracket: DontAlign
AlignArrayOfStructures: None
AlignConsecutiveMacros: false
AlignConsecutiveAssignments: false
AlignConsecutiveBitFields: false
AlignConsecutiveDeclarations: false
AlignEscapedNewlines: Right
AlignOperands:   DontAlign
AlignTrailingComments: true
AllowAllArgumentsOnNextLine: false
AllowAllConstructorInitializersOnNextLine: false
AllowAllParametersOfDeclarationOnNextLine: false
AllowShortEnumsOnASingleLine: true
AllowShortBlocksOnASingleLine: Empty
AllowShortCaseLabelsOnASingleLine: false
AllowShortFunctionsOnASingleLine: Empty
AllowShortLambdasOnASingleLine: All
AllowShortIfStatementsOnASingleLine: Never
AllowShortLoopsOnASingleLine: false
AlwaysBreakAfterDefinitionReturnType: true
AlwaysBreakAfterReturnType: None
AlwaysBreakBeforeMultilineStrings: true
AlwaysBreakTemplateDeclarations: No
AttributeMacros:
  - __capability
BinPackArguments: true
BinPackParameters: true
BraceWrapping:
  AfterCaseLabel:  true
  AfterClass:      true
  AfterControlStatement: false
  AfterEnum:       true
  AfterFunction:   true
  AfterNamespace:  true
  AfterObjCDeclaration: true
  AfterStruct:     false
  AfterUnion:      false
  AfterExternBlock: true
  BeforeCatch:     true
  BeforeElse:      true
  BeforeLambdaBody: true
  BeforeWhile:     false
  IndentBraces:    false
  SplitEmptyFunction: true
  SplitEmptyRecord: true
  SplitEmptyNamespace: true
BreakBeforeBinaryOperators: None
BreakBeforeConceptDeclarations: true
BreakBeforeBraces: Custom
BreakBeforeInheritanceComma: false
BreakInheritanceList: BeforeColon
BreakBeforeTernaryOperators: true
BreakConstructorInitializersBeforeComma: false
BreakConstructorInitializers: BeforeColon
BreakAfterJavaFieldAnnotations: false
BreakStringLiterals: true
ColumnLimit:     80
CommentPragmas:  '^ IWYU pragma:'
CompactNamespaces: false
ConstructorInitializerAllOnOneLineOrOnePerLine: false
ConstructorInitializerIndentWidth: 4
ContinuationIndentWidth: 4
Cpp11BracedListStyle: true
DeriveLineEnding: true
DerivePointerAlignment: false
DisableFormat:   false
EmptyLineAfterAccessModifier: Never
EmptyLineBeforeAccessModifier: LogicalBlock
ExperimentalAutoDetectBinPacking: false
FixNamespaceComments: true
ForEachMacros:
  - foreach
  - Q_FOREACH
  - BOOST_FOREACH
IfMacros:
  - KJ_IF_MAYBE
IncludeBlocks:   Preserve
IncludeCategories:
  - Regex:           '^"(llvm|llvm-c|clang|clang-c)/'
    Priority:        2
    SortPriority:    0
    CaseSensitive:   false
  - Regex:           '^(<|"(gtest|gmock|isl|json)/)'
    Priority:        3
    SortPriority:    0
    CaseSensitive:   false
  - Regex:           '.*'
    Priority:        1
    SortPriority:    0
    CaseSensitive:   false
IncludeIsMainRegex: '(Test)?$'
IncludeIsMainSourceRegex: ''
IndentAccessModifiers: false
IndentCaseLabels: true
IndentCaseBlocks: false
IndentGotoLabels: true
IndentPPDirectives: None
IndentExternBlock: AfterExternBlock
IndentRequires:  false
IndentWidth:     2
IndentWrappedFunctionNames: false
InsertTrailingCommas: None
JavaScriptQuotes: Leave
JavaScriptWrapImports: true
KeepEmptyLinesAtTheStartOfBlocks: true
LambdaBodyIndentation: Signature
MacroBlockBegin: ''
MacroBlockEnd:   ''
MaxEmptyLinesToKeep: 2
NamespaceIndentation: None
ObjCBinPackProtocolList: Auto
ObjCBlockIndentWidth: 2
ObjCBreakBeforeNestedBlockParam: true
ObjCSpaceAfterProperty: false
ObjCSpaceBeforeProtocolList: true
PenaltyBreakAssignment: 2
PenaltyBreakBeforeFirstCallParameter: 19
PenaltyBreakComment: 300
PenaltyBreakFirstLessLess: 120
PenaltyBreakString: 1000
PenaltyBreakTemplateDeclaration: 10
PenaltyExcessCharacter: 1000000
PenaltyReturnTypeOnItsOwnLine: 60
PenaltyIndentedWhitespace: 0
PointerAlignment: Right
PPIndentWidth:   -1
ReferenceAlignment: Pointer
ReflowComments:  true
ShortNamespaceLines: 1
SortIncludes:  false 
SortJavaStaticImport: Before
SortUsingDeclarations: true
SpaceAfterCStyleCast: true
SpaceAfterLogicalNot: false
SpaceAfterTemplateKeyword: true
SpaceBeforeAssignmentOperators: true
SpaceBeforeCaseColon: false
SpaceBeforeCpp11BracedList: true
SpaceBeforeCtorInitializerColon: true
SpaceBeforeInheritanceColon: true
SpaceBeforeParens: Never
SpaceAroundPointerQualifiers: Default
SpaceBeforeRangeBasedForLoopColon: true
SpaceInEmptyBlock: false
SpaceInEmptyParentheses: false
SpacesBeforeTrailingComments: 1
SpacesInAngles:  Never
SpacesInConditionalStatement: false
SpacesInContainerLiterals: false
SpacesInCStyleCastParentheses: false
SpacesInLineCommentPrefix:
  Minimum:         1
  Maximum:         -1
SpacesInParentheses: false
SpacesInSquareBrackets: false
SpaceBeforeSquareBrackets: false
BitFieldColonSpacing: Both
Standard:        Latest
StatementAttributeLikeMacros:
  - Q_EMIT
StatementMacros:
  - Q_UNUSED
  - QT_REQUIRE_VERSION
TabWidth:        8
UseCRLF:         false
UseTab:          Never
WhitespaceSensitiveMacros:
  - STRINGIZE
  - PP_STRINGIZE
  - BOOST_PP_STRINGIZE
  - NS_SWIFT_NAME
  - CF_SWIFT_NAME
...
```
::: 

---

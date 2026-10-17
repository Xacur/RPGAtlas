Unicode true
RequestExecutionLevel user

!define APP_NAME "Atlas Quest Electron POC"
!define APP_DIR "$PLUGINSDIR\AtlasQuest"
!define GAME_EXE "Test_RPG_Project.exe"

Name "${APP_NAME}"
OutFile "Z:\home\xacur\Sites\RPGAtlas\electron-poc\dist\Atlas-Quest-NSIS-Portable.exe"
SilentInstall silent
SilentUnInstall silent
AutoCloseWindow true
Icon "Z:\home\xacur\Sites\RPGAtlas\poc-icon.ico"

VIProductVersion "1.0.0.0"
VIAddVersionKey ProductName "Atlas Quest Electron POC"
VIAddVersionKey FileDescription "Atlas Quest Electron POC"
VIAddVersionKey ProductVersion "1.0.0"
VIAddVersionKey FileVersion "1.0.0"

Function .onInit
  InitPluginsDir
  SetOutPath "${APP_DIR}"
  File /r "Z:\home\xacur\Sites\RPGAtlas\electron-poc\dist\nsis-input\*"
FunctionEnd

Section
  SetOutPath "${APP_DIR}"
  ExecWait '"${APP_DIR}\${GAME_EXE}"'
SectionEnd

Function .onInstSuccess
  RMDir /r "${APP_DIR}"
FunctionEnd

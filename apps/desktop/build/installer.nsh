!macro preInit
  ; Never reuse a legacy/custom InstallLocation. Older builds allowed users to
  ; select any folder, which made NSIS recursively remove unrelated files.
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\${PRODUCT_FILENAME}"
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\${PRODUCT_FILENAME}"
!macroend

!macro customInit
  ; This also neutralizes NSIS /D= command-line overrides.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${PRODUCT_FILENAME}"
!macroend

!macro customUnInit
  ; The stock electron-builder uninstaller recursively removes $INSTDIR.
  ; Abort unless it is the one dedicated application directory we own.
  ${If} $INSTDIR != "$LOCALAPPDATA\Programs\${PRODUCT_FILENAME}"
    MessageBox MB_ICONSTOP|MB_OK "Uninstall stopped because the registered installation folder is unsafe: $INSTDIR"
    Abort
  ${EndIf}
!macroend

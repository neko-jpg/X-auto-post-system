@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: =============================================================================
:: X Auto-Post System - セットアップスクリプト
:: =============================================================================
:: 使い方:
::   run.bat help   - コマンド一覧を表示
::   run.bat setup  - 依存関係をインストール
::   run.bat app    - アプリを起動
:: =============================================================================

:: スクリプトのあるディレクトリを基準にする
set "ROOT_DIR=%~dp0"
set "NEXT_APP=%ROOT_DIR%next-app"

:: 引数がなければヘルプを表示
if "%1"=="" goto help

:: コマンドの振り分け
if /i "%1"=="help" goto help
if /i "%1"=="setup" goto setup
if /i "%1"=="app" goto app
if /i "%1"=="dev" goto app
if /i "%1"=="run" goto app
if /i "%1"=="build" goto build
if /i "%1"=="test" goto test
if /i "%1"=="clean" goto clean
if /i "%1"=="reset" goto reset
if /i "%1"=="status" goto status
if /i "%1"=="legacy" goto legacy

echo.
echo [エラー] 不明なコマンド: %1
echo.
goto help

:: -----------------------------------------------------------------------------
:: help - コマンド一覧を表示
:: -----------------------------------------------------------------------------
:help
echo.
echo ========================================================
echo   X Auto-Post System - コマンド一覧
echo ========================================================
echo.
echo   [セットアップ]
echo     run setup    : 依存関係をすべてインストール
echo     run reset    : クリーン + 再インストール
echo     run status   : 環境状態を確認（Node.jsバージョン等）
echo.
echo   [アプリ起動]
echo     run app      : Next.jsアプリを起動（開発モード）
echo     run dev      : run app と同じ
echo.
echo   [ビルド・テスト]
echo     run build    : プロダクションビルド
echo     run test     : テストを実行
echo.
echo   [クリーンアップ]
echo     run clean    : node_modules を削除
echo.
echo ========================================================
echo   初めての場合: run setup を実行してください
echo ========================================================
echo.
goto end

:: -----------------------------------------------------------------------------
:: status - 環境状態を確認
:: -----------------------------------------------------------------------------
:status
echo.
echo [環境チェック]
echo ----------------------------------------
echo Node.js バージョン:
node --version 2>nul || echo   ※ Node.js がインストールされていません
echo.
echo npm バージョン:
npm --version 2>nul || echo   ※ npm がインストールされていません
echo.
echo [インストール状態]
echo ----------------------------------------
if exist "%NEXT_APP%\node_modules" (
    echo   next-app/node_modules: OK
) else (
    echo   next-app/node_modules: 未インストール
)
echo.
goto end

:: -----------------------------------------------------------------------------
:: setup - 依存関係をインストール
:: -----------------------------------------------------------------------------
:setup
call :check-node
if errorlevel 1 goto end

echo.
echo ========================================
echo   依存関係をインストール中...
echo ========================================
echo.
cd /d "%NEXT_APP%"
call npm install
if errorlevel 1 (
    echo.
    echo [エラー] インストールに失敗しました
    goto end
)
echo.
echo ========================================
echo   セットアップ完了！
echo   「run app」でアプリを起動できます
echo ========================================
echo.
goto end

:: -----------------------------------------------------------------------------
:: app - Next.jsアプリを起動
:: -----------------------------------------------------------------------------
:app
call :check-node
if errorlevel 1 goto end

echo.
echo ========================================
echo   Next.js アプリを起動中...
echo   URL: http://localhost:3000
echo   停止: Ctrl + C
echo ========================================
echo.
cd /d "%NEXT_APP%"
call npm run dev
goto end

:: -----------------------------------------------------------------------------
:: legacy - レガシー版（Vanilla JS）を起動
:: -----------------------------------------------------------------------------
:legacy
echo.
echo ========================================
echo   レガシー版を起動中...
echo ========================================
echo.
cd /d "%ROOT_DIR%"
call npm run dev
goto end

:: -----------------------------------------------------------------------------
:: build - プロダクションビルド
:: -----------------------------------------------------------------------------
:build
call :check-node
if errorlevel 1 goto end

echo.
echo ========================================
echo   プロダクションビルド中...
echo ========================================
echo.
cd /d "%NEXT_APP%"
call npm run build
goto end

:: -----------------------------------------------------------------------------
:: test - テスト実行
:: -----------------------------------------------------------------------------
:test
echo.
echo ========================================
echo   テストを実行中...
echo ========================================
echo.
cd /d "%ROOT_DIR%"
call npm test
goto end

:: -----------------------------------------------------------------------------
:: clean - node_modulesを削除
:: -----------------------------------------------------------------------------
:clean
echo.
echo ========================================
echo   クリーンアップ中...
echo ========================================
echo.
if exist "%NEXT_APP%\node_modules" (
    rmdir /s /q "%NEXT_APP%\node_modules"
    echo   next-app/node_modules 削除完了
) else (
    echo   next-app/node_modules は存在しません
)
if exist "%ROOT_DIR%node_modules" (
    rmdir /s /q "%ROOT_DIR%node_modules"
    echo   ルート/node_modules 削除完了
) else (
    echo   ルート/node_modules は存在しません
)
echo.
echo   クリーンアップ完了！
echo.
goto end

:: -----------------------------------------------------------------------------
:: reset - クリーン + 再インストール
:: -----------------------------------------------------------------------------
:reset
call :clean
call :setup
echo.
echo ========================================
echo   リセット完了！
echo ========================================
echo.
goto end

:: -----------------------------------------------------------------------------
:: check-node - Node.jsがインストールされているか確認
:: -----------------------------------------------------------------------------
:check-node
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [エラー] Node.js がインストールされていません
    echo https://nodejs.org/ からダウンロードしてください
    echo.
    exit /b 1
)
exit /b 0

:end
endlocal

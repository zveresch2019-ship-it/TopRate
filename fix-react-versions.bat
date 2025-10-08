@echo off
echo Исправляем версии React...
npm install react@19.1.1 react-dom@19.1.1 --legacy-peer-deps
echo Готово! Теперь запускаем приложение...
npx expo start --web
pause


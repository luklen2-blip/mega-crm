Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\luciano\.gemini\antigravity\scratch\mega-crm"
WshShell.Run "cmd /c node server.js", 0, False

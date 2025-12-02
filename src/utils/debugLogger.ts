// Debug logger component for visual debugging
export class DebugLogger {
  private debugPanel: HTMLDivElement;
  private toggleButton: HTMLButtonElement;
  private isVisible: boolean = false;

  constructor(container: HTMLElement) {
    // Create toggle button
    this.toggleButton = document.createElement("button");
    this.toggleButton.textContent = "📋";
    this.toggleButton.style.position = "absolute";
    this.toggleButton.style.bottom = "5px";
    this.toggleButton.style.right = "5px";
    this.toggleButton.style.width = "30px";
    this.toggleButton.style.height = "30px";
    this.toggleButton.style.fontSize = "16px";
    this.toggleButton.style.background = "rgba(0,0,0,0.7)";
    this.toggleButton.style.border = "1px solid #0f0";
    this.toggleButton.style.borderRadius = "4px";
    this.toggleButton.style.color = "#0f0";
    this.toggleButton.style.cursor = "pointer";
    this.toggleButton.style.zIndex = "10000";
    this.toggleButton.title = "Toggle Debug Logs";
    
    this.toggleButton.addEventListener("click", () => this.toggle());
    
    // Create debug panel
    this.debugPanel = document.createElement("div");
    this.debugPanel.style.position = "absolute";
    this.debugPanel.style.bottom = "0";
    this.debugPanel.style.left = "0";
    this.debugPanel.style.right = "0";
    this.debugPanel.style.fontSize = "10px";
    this.debugPanel.style.fontFamily = "monospace";
    this.debugPanel.style.whiteSpace = "pre-wrap";
    this.debugPanel.style.maxHeight = "150px";
    this.debugPanel.style.overflowY = "auto";
    this.debugPanel.style.background = "rgba(0,0,0,0.8)";
    this.debugPanel.style.color = "#0f0";
    this.debugPanel.style.padding = "5px";
    this.debugPanel.style.paddingBottom = "40px";
    this.debugPanel.style.zIndex = "9999";
    this.debugPanel.style.borderTop = "1px solid #0f0";
    this.debugPanel.style.userSelect = "text";
    this.debugPanel.style.cursor = "text";
    this.debugPanel.style.display = "none"; // Hidden by default

    container.appendChild(this.debugPanel);
    container.appendChild(this.toggleButton);
    this.log("DebugLogger initialized");
  }

  public log(msg: string, data?: any) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    let line = `[${timestamp}] ${msg}`;
    
    if (data !== undefined) {
      if (typeof data === 'object') {
        line += `\n  ${JSON.stringify(data, null, 2).split('\n').join('\n  ')}`;
      } else {
        line += ` ${data}`;
      }
    }
    
    console.log(line);
    
    // Only add to panel if visible
    if (this.isVisible) {
      this.debugPanel.textContent += line + "\n";
      // Auto-scroll to bottom
      this.debugPanel.scrollTop = this.debugPanel.scrollHeight;
    }
  }

  public clear() {
    this.debugPanel.textContent = "";
  }

  public toggle() {
    this.isVisible = !this.isVisible;
    this.debugPanel.style.display = this.isVisible ? "block" : "none";
  }

  public hide() {
    this.isVisible = false;
    this.debugPanel.style.display = "none";
  }

  public show() {
    this.isVisible = true;
    this.debugPanel.style.display = "block";
  }
}

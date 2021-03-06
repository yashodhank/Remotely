import { AudioButton, ChangeScreenButton, HorizontalBars, ScreenSelectBar, ClipboardTransferButton, ClipboardTransferBar, TypeClipboardButton, ShowMessage, ConnectButton, CtrlAltDelButton, DisconnectButton, FileTransferButton, FileTransferInput, FitToScreenButton, ScreenViewer, BlockInputButton, InviteButton, KeyboardButton, TouchKeyboardTextArea, MenuFrame, MenuButton, QualityButton, QualityBar, QualitySlider, AutoQualityAdjustCheckBox, ScreenViewerWrapper, WindowsSessionSelect, RecordSessionButton, DownloadRecordingButton } from "./UI.js";
import { Sound } from "../Sound.js";
import { MainRc } from "./Main.js";
import { UploadFiles } from "./FileUploader.js";
import { RemoteControlMode } from "../Enums/RemoteControlMode.js";
import { GetDistanceBetween } from "../Utilities.js";
var lastPointerMove = Date.now();
var isDragging;
var currentPointerDevice;
var currentTouchCount;
var cancelNextViewerClick;
var isPinchZooming;
var startPinchPoint1;
var startPinchPoint2;
var lastPinchDistance;
var isMenuButtonDragging;
var startMenuDraggingY;
var startLongPressTimeout;
var lastPinchCenterX;
var lastPinchCenterY;
export function ApplyInputHandlers() {
    AudioButton.addEventListener("click", (ev) => {
        AudioButton.classList.toggle("toggled");
        var toggleOn = AudioButton.classList.contains("toggled");
        if (toggleOn) {
            Sound.Init();
        }
        MainRc.MessageSender.SendToggleAudio(toggleOn);
    });
    ChangeScreenButton.addEventListener("click", (ev) => {
        closeAllHorizontalBars("screenSelectBar");
        ScreenSelectBar.classList.toggle("open");
    });
    ClipboardTransferButton.addEventListener("click", (ev) => {
        closeAllHorizontalBars("clipboardTransferBar");
        ClipboardTransferBar.classList.toggle("open");
    });
    TypeClipboardButton.addEventListener("click", (ev) => {
        if (!navigator.clipboard.readText) {
            alert("Clipboard access isn't supported on this browser.");
            return;
        }
        navigator.clipboard.readText().then(text => {
            MainRc.MessageSender.SendClipboardTransfer(text, true);
            ShowMessage("Clipboard sent!");
        }, reason => {
            alert("Unable to read clipboard.  Please check your permissions.");
            console.log("Unable to read clipboard.  Reason: " + reason);
        });
    });
    ConnectButton.addEventListener("click", (ev) => {
        MainRc.ConnectToClient();
    });
    CtrlAltDelButton.addEventListener("click", (ev) => {
        if (!MainRc.ServiceID) {
            ShowMessage("Not available for this session.");
            return;
        }
        closeAllHorizontalBars(null);
        MainRc.MessageSender.SendCtrlAltDel();
    });
    DisconnectButton.addEventListener("click", (ev) => {
        ConnectButton.removeAttribute("disabled");
        MainRc.RCHubConnection.Connection.stop();
        if (location.search.includes("fromApi=true")) {
            window.close();
        }
    });
    document.querySelectorAll("#sessionIDInput, #nameInput").forEach(x => {
        x.addEventListener("keypress", (ev) => {
            if (ev.key.toLowerCase() == "enter") {
                MainRc.ConnectToClient();
            }
        });
    });
    FileTransferButton.addEventListener("click", (ev) => {
        FileTransferInput.click();
    });
    FileTransferInput.addEventListener("change", (ev) => {
        UploadFiles(FileTransferInput.files);
    });
    FitToScreenButton.addEventListener("click", (ev) => {
        FitToScreenButton.classList.toggle("toggled");
        if (FitToScreenButton.classList.contains("toggled")) {
            ScreenViewer.style.removeProperty("max-width");
            ScreenViewer.style.removeProperty("max-height");
        }
        else {
            ScreenViewer.style.maxWidth = "unset";
            ScreenViewer.style.maxHeight = "unset";
        }
    });
    BlockInputButton.addEventListener("click", (ev) => {
        var button = ev.currentTarget;
        button.classList.toggle("toggled");
        if (button.classList.contains("toggled")) {
            MainRc.MessageSender.SendToggleBlockInput(true);
        }
        else {
            MainRc.MessageSender.SendToggleBlockInput(false);
        }
    });
    InviteButton.addEventListener("click", (ev) => {
        var url = "";
        if (MainRc.Mode == RemoteControlMode.Normal) {
            url = `${location.origin}${location.pathname}?sessionID=${MainRc.ClientID}`;
        }
        else {
            url = `${location.origin}${location.pathname}?clientID=${MainRc.ClientID}&serviceID=${MainRc.ServiceID}`;
        }
        MainRc.ClipboardWatcher.SetClipboardText(url);
        ShowMessage("Link copied to clipboard.");
    });
    KeyboardButton.addEventListener("click", (ev) => {
        closeAllHorizontalBars(null);
        TouchKeyboardTextArea.focus();
        TouchKeyboardTextArea.setSelectionRange(TouchKeyboardTextArea.value.length, TouchKeyboardTextArea.value.length);
        MenuFrame.classList.remove("open");
        MenuButton.classList.remove("open");
    });
    MenuButton.addEventListener("click", (ev) => {
        if (isMenuButtonDragging) {
            isMenuButtonDragging = false;
            return;
        }
        MenuFrame.classList.toggle("open");
        MenuButton.classList.toggle("open");
        closeAllHorizontalBars(null);
    });
    MenuButton.addEventListener("mousedown", (ev) => {
        isMenuButtonDragging = false;
        startMenuDraggingY = ev.clientY;
        window.addEventListener("mousemove", moveMenuButton);
        window.addEventListener("mouseup", removeMouseButtonWindowListeners);
        window.addEventListener("mouseleave", removeMouseButtonWindowListeners);
    });
    MenuButton.addEventListener("touchmove", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        MenuButton.style.top = `${ev.touches[0].clientY}px`;
    });
    QualityButton.addEventListener("click", (ev) => {
        closeAllHorizontalBars("qualityBar");
        QualityBar.classList.toggle("open");
    });
    QualitySlider.addEventListener("change", (ev) => {
        MainRc.MessageSender.SendQualityChange(Number(QualitySlider.value));
    });
    AutoQualityAdjustCheckBox.addEventListener("change", ev => {
        MainRc.MessageSender.SendAutoQualityAdjust(AutoQualityAdjustCheckBox.checked);
    });
    ScreenViewer.addEventListener("pointermove", function (e) {
        currentPointerDevice = e.pointerType;
    });
    ScreenViewer.addEventListener("pointerdown", function (e) {
        currentPointerDevice = e.pointerType;
    });
    ScreenViewer.addEventListener("pointerenter", function (e) {
        currentPointerDevice = e.pointerType;
    });
    ScreenViewer.addEventListener("mousemove", function (e) {
        e.preventDefault();
        if (Date.now() - lastPointerMove < 25) {
            return;
        }
        lastPointerMove = Date.now();
        var percentX = e.offsetX / ScreenViewer.clientWidth;
        var percentY = e.offsetY / ScreenViewer.clientHeight;
        MainRc.MessageSender.SendMouseMove(percentX, percentY);
    });
    ScreenViewer.addEventListener("mousedown", function (e) {
        if (currentPointerDevice == "touch") {
            return;
        }
        if (e.button != 0 && e.button != 2) {
            return;
        }
        e.preventDefault();
        var percentX = e.offsetX / ScreenViewer.clientWidth;
        var percentY = e.offsetY / ScreenViewer.clientHeight;
        MainRc.MessageSender.SendMouseDown(e.button, percentX, percentY);
    });
    ScreenViewer.addEventListener("mouseup", function (e) {
        if (currentPointerDevice == "touch") {
            return;
        }
        if (e.button != 0 && e.button != 2) {
            return;
        }
        e.preventDefault();
        var percentX = e.offsetX / ScreenViewer.clientWidth;
        var percentY = e.offsetY / ScreenViewer.clientHeight;
        MainRc.MessageSender.SendMouseUp(e.button, percentX, percentY);
    });
    ScreenViewer.addEventListener("click", function (e) {
        if (cancelNextViewerClick) {
            cancelNextViewerClick = false;
            return;
        }
        if (currentPointerDevice == "mouse") {
            e.preventDefault();
            e.stopPropagation();
        }
        else if (currentPointerDevice == "touch" && currentTouchCount == 0) {
            var percentX = e.offsetX / ScreenViewer.clientWidth;
            var percentY = e.offsetY / ScreenViewer.clientHeight;
            MainRc.MessageSender.SendTap(percentX, percentY);
        }
    });
    ScreenViewer.addEventListener("touchstart", function (e) {
        currentTouchCount = e.touches.length;
        if (currentTouchCount == 1) {
            startLongPressTimeout = window.setTimeout(() => {
                var percentX = e.touches[0].pageX / ScreenViewer.clientWidth;
                var percentY = e.touches[0].pageY / ScreenViewer.clientHeight;
                MainRc.MessageSender.SendMouseDown(2, percentX, percentY);
                MainRc.MessageSender.SendMouseUp(2, percentX, percentY);
            }, 1000);
        }
        if (currentTouchCount > 1) {
            cancelNextViewerClick = true;
        }
        if (currentTouchCount == 2) {
            startPinchPoint1 = { X: e.touches[0].pageX, Y: e.touches[0].pageY, IsEmpty: false };
            startPinchPoint2 = { X: e.touches[1].pageX, Y: e.touches[1].pageY, IsEmpty: false };
            lastPinchDistance = GetDistanceBetween(startPinchPoint1.X, startPinchPoint1.Y, startPinchPoint2.X, startPinchPoint2.Y);
            lastPinchCenterX = (startPinchPoint1.X + startPinchPoint2.X) / 2;
            lastPinchCenterY = (startPinchPoint1.Y + startPinchPoint2.Y) / 2;
        }
        isDragging = false;
        KeyboardButton.removeAttribute("hidden");
        var focusedInput = document.querySelector("input:focus");
        if (focusedInput) {
            focusedInput.blur();
        }
    });
    ScreenViewer.addEventListener("touchmove", function (e) {
        currentTouchCount = e.touches.length;
        clearTimeout(startLongPressTimeout);
        if (e.touches.length == 2) {
            var pinchPoint1 = {
                X: e.touches[0].pageX,
                Y: e.touches[0].pageY,
                IsEmpty: false
            };
            var pinchPoint2 = {
                X: e.touches[1].pageX,
                Y: e.touches[1].pageY,
                IsEmpty: false
            };
            var pinchDistance = GetDistanceBetween(pinchPoint1.X, pinchPoint1.Y, pinchPoint2.X, pinchPoint2.Y);
            var pinchCenterX = (pinchPoint1.X + pinchPoint2.X) / 2;
            var pinchCenterY = (pinchPoint1.Y + pinchPoint2.Y) / 2;
            ScreenViewerWrapper.scrollBy(lastPinchCenterX - pinchCenterX, lastPinchCenterY - pinchCenterY);
            lastPinchCenterX = pinchCenterX;
            lastPinchCenterY = pinchCenterY;
            if (Math.abs(pinchDistance - lastPinchDistance) > 5) {
                isPinchZooming = true;
                if (FitToScreenButton.classList.contains("toggled")) {
                    FitToScreenButton.click();
                }
                var currentWidth = ScreenViewer.clientWidth;
                var currentHeight = ScreenViewer.clientHeight;
                var clientAdjustedScrollLeftPercent = (ScreenViewerWrapper.scrollLeft + (ScreenViewerWrapper.clientWidth * .5)) / ScreenViewerWrapper.scrollWidth;
                var clientAdjustedScrollTopPercent = (ScreenViewerWrapper.scrollTop + (ScreenViewerWrapper.clientHeight * .5)) / ScreenViewerWrapper.scrollHeight;
                var currentWidthPercent = Number(ScreenViewer.style.width.slice(0, -1));
                var newWidthPercent = Math.max(100, (currentWidthPercent + (pinchDistance - lastPinchDistance) * (currentWidthPercent / 100)));
                newWidthPercent = Math.min(5000, newWidthPercent);
                ScreenViewer.style.width = String(newWidthPercent) + "%";
                var heightChange = ScreenViewer.clientHeight - currentHeight;
                var widthChange = ScreenViewer.clientWidth - currentWidth;
                var pinchAdjustX = pinchCenterX / window.innerWidth - .5;
                var pinchAdjustY = pinchCenterY / window.innerHeight - .5;
                var scrollByX = widthChange * (clientAdjustedScrollLeftPercent + (pinchAdjustX * ScreenViewerWrapper.clientWidth / ScreenViewerWrapper.scrollWidth));
                var scrollByY = heightChange * (clientAdjustedScrollTopPercent + (pinchAdjustY * ScreenViewerWrapper.clientHeight / ScreenViewerWrapper.scrollHeight));
                ScreenViewerWrapper.scrollBy(scrollByX, scrollByY);
                lastPinchDistance = pinchDistance;
            }
            return;
        }
        else if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            var screenViewerLeft = ScreenViewer.getBoundingClientRect().left;
            var screenViewerTop = ScreenViewer.getBoundingClientRect().top;
            var pagePercentX = (e.touches[0].pageX - screenViewerLeft) / ScreenViewer.clientWidth;
            var pagePercentY = (e.touches[0].pageY - screenViewerTop) / ScreenViewer.clientHeight;
            MainRc.MessageSender.SendMouseMove(pagePercentX, pagePercentY);
        }
    });
    ScreenViewer.addEventListener("touchend", function (e) {
        currentTouchCount = e.touches.length;
        clearTimeout(startLongPressTimeout);
        if (e.touches.length == 1 && !isPinchZooming) {
            isDragging = true;
            var percentX = (e.touches[0].pageX - ScreenViewer.getBoundingClientRect().left) / ScreenViewer.clientWidth;
            var percentY = (e.touches[0].pageY - ScreenViewer.getBoundingClientRect().top) / ScreenViewer.clientHeight;
            MainRc.MessageSender.SendMouseMove(percentX, percentY);
            MainRc.MessageSender.SendMouseDown(0, percentX, percentY);
            return;
        }
        if (currentTouchCount == 0) {
            cancelNextViewerClick = false;
            isPinchZooming = false;
            startPinchPoint1 = null;
            startPinchPoint2 = null;
        }
        if (isDragging) {
            var percentX = (e.changedTouches[0].pageX - ScreenViewer.getBoundingClientRect().left) / ScreenViewer.clientWidth;
            var percentY = (e.changedTouches[0].pageY - ScreenViewer.getBoundingClientRect().top) / ScreenViewer.clientHeight;
            MainRc.MessageSender.SendMouseUp(0, percentX, percentY);
        }
        isDragging = false;
    });
    ScreenViewer.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
    });
    ScreenViewer.addEventListener("wheel", function (e) {
        e.preventDefault();
        MainRc.MessageSender.SendMouseWheel(e.deltaX, e.deltaY);
    });
    TouchKeyboardTextArea.addEventListener("input", (ev) => {
        if (TouchKeyboardTextArea.value.length == 1) {
            MainRc.MessageSender.SendKeyPress("Backspace");
        }
        else if (TouchKeyboardTextArea.value.endsWith("\n")) {
            MainRc.MessageSender.SendKeyPress("Enter");
        }
        else if (TouchKeyboardTextArea.value.endsWith(" ")) {
            MainRc.MessageSender.SendKeyPress(" ");
        }
        else {
            var input = TouchKeyboardTextArea.value.trim().substr(1);
            for (var i = 0; i < input.length; i++) {
                var character = input.charAt(i);
                var sendShift = character.match(/[A-Z~!@#$%^&*()_+{}|<>?]/);
                if (sendShift) {
                    MainRc.MessageSender.SendKeyDown("Shift");
                }
                MainRc.MessageSender.SendKeyPress(character);
                if (sendShift) {
                    MainRc.MessageSender.SendKeyUp("Shift");
                }
            }
        }
        window.setTimeout(() => {
            TouchKeyboardTextArea.value = " #";
            TouchKeyboardTextArea.setSelectionRange(TouchKeyboardTextArea.value.length, TouchKeyboardTextArea.value.length);
        });
    });
    WindowsSessionSelect.addEventListener("focus", () => {
        MainRc.MessageSender.GetWindowsSessions();
    });
    WindowsSessionSelect.addEventListener("change", () => {
        ShowMessage("Switching sessions...");
        MainRc.MessageSender.ChangeWindowsSession(Number(WindowsSessionSelect.selectedOptions[0].value));
    });
    RecordSessionButton.addEventListener("click", () => {
        RecordSessionButton.classList.toggle("toggled");
        if (RecordSessionButton.classList.contains("toggled")) {
            RecordSessionButton.innerHTML = `Stop <i class="fas fa-record-vinyl">`;
            MainRc.SessionRecorder.Start();
        }
        else {
            RecordSessionButton.innerHTML = `Start <i class="fas fa-record-vinyl">`;
            MainRc.SessionRecorder.Stop();
        }
    });
    DownloadRecordingButton.addEventListener("click", () => {
        MainRc.SessionRecorder.DownloadVideo();
    });
    window.addEventListener("keydown", function (e) {
        if (document.querySelector("input:focus") || document.querySelector("textarea:focus")) {
            return;
        }
        e.preventDefault();
        MainRc.MessageSender.SendKeyDown(e.key);
    });
    window.addEventListener("keyup", function (e) {
        if (document.querySelector("input:focus") || document.querySelector("textarea:focus")) {
            return;
        }
        e.preventDefault();
        MainRc.MessageSender.SendKeyUp(e.key);
    });
    window.addEventListener("blur", () => {
        MainRc.MessageSender.SendSetKeyStatesUp();
    });
    window.ondragover = function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };
    window.ondrop = function (e) {
        e.preventDefault();
        if (e.dataTransfer.files.length < 1) {
            return;
        }
        UploadFiles(e.dataTransfer.files);
    };
}
function closeAllHorizontalBars(exceptBarId) {
    HorizontalBars.forEach(x => {
        if (x.id != exceptBarId) {
            x.classList.remove('open');
        }
    });
}
function moveMenuButton(ev) {
    if (Math.abs(ev.clientY - startMenuDraggingY) > 5) {
        if (ev.clientY < 0 || ev.clientY > window.innerHeight) {
            return;
        }
        isMenuButtonDragging = true;
        MenuButton.style.top = `${ev.clientY}px`;
    }
}
function removeMouseButtonWindowListeners(ev) {
    window.removeEventListener("mousemove", moveMenuButton);
    window.removeEventListener("mouseup", removeMouseButtonWindowListeners);
    window.removeEventListener("mouseleave", removeMouseButtonWindowListeners);
}
//# sourceMappingURL=InputEventHandlers.js.map
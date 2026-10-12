// SIDINEYA 2.5 — versão userscript (Tampermonkey) hospedada na Vercel
// Carregado via @require. As permissões @grant e @match ficam no cabeçalho do Tampermonkey.

(function () {
    'use strict';

    const CONFIG = {
        checkSelector: 'a[aria-label*="INCIDENTE BACKLOG - CGS NOC"]',
        reavisoMarcos: [5, 10, 13],
        debounceSubida: 2000,
        debounceDescida: 4000,
        limiteRealtime: 3,
        // Intervalos possíveis em minutos convertidos para ms (4, 7 e 9 minutos)
        refreshOpcoesMinutos: [4, 7, 9],
        storageKey: 'sidineya_state',
        // ⚠️ TROQUE pela URL do seu projeto na Vercel (com a barra no final)
        assetBase: 'https://sidineya-vercel.vercel.app/',
        gateReavisoMs: 30 * 1000,
        filaUrl: 'https://equatorialenergia.service-now.com/incident_list.do?sysparm_query=assignment_group%3D4aef55d3dbe44050d36963901496195c%5EstateNOT%20IN6%2C7%2C8'
    };

    // -----------------------------
    // 🔓 DESBLOQUEADOR DE ÁUDIO (Autoplay)
    // -----------------------------
    function inicializarDesbloqueioAudio() {
        const desbloquear = async () => {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            const buffer = audioCtx.createBuffer(1, 1, 22050);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);

            console.log('[SIDINEYA] Áudio desbloqueado com sucesso!');
            window.removeEventListener('click', desbloquear);
            window.removeEventListener('keydown', desbloquear);
        };

        window.addEventListener('click', desbloquear, { once: true });
        window.addEventListener('keydown', desbloquear, { once: true });
    }

    // -----------------------------
    // 🎨 ESTILOS DO BALÃO
    // -----------------------------

    function injetarEstilos() {
        if (document.getElementById('sidineya-styles')) return;
        const style = document.createElement('style');
        style.id = 'sidineya-styles';
        style.textContent = `
            #sid-balloon {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 2147483647;
                background: #141720;
                border: 1px solid #1e2535;
                border-radius: 10px;
                box-shadow: 0 12px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(0,200,255,.06), 0 4px 16px rgba(0,200,255,.08);
                width: 120px;
                padding: 8px 10px 7px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                gap: 0;
                overflow: hidden;
                outline: 1.5px solid transparent;
                transition: outline-color .25s, box-shadow .25s;
                animation: sid-slideIn .28s cubic-bezier(.22,1,.36,1) both;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            #sid-balloon:hover {
                outline-color: #00c8ff;
                box-shadow: 0 12px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(0,200,255,.15), 0 4px 24px rgba(0,200,255,.14);
            }
            #sid-balloon::before {
                content: '';
                position: absolute;
                top: 0; left: 10px; right: 10px;
                height: 2px;
                background: linear-gradient(90deg, transparent, #00c8ff55, transparent);
                border-radius: 99px;
            }
            #sid-balloon.leaving {
                animation: sid-slideOut .2s ease-in forwards;
            }
            .sid-tag {
                font-size: 7px;
                letter-spacing: .18em;
                color: #5a6a85;
                text-transform: uppercase;
                margin-bottom: 5px;
            }
            .sid-row-number {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }
            .sid-number {
                font-size: 28px;
                font-weight: 700;
                line-height: 1;
                color: #00c8ff;
                text-shadow: 0 0 28px rgba(0,200,255,.4);
                transition: color .3s, text-shadow .3s;
                letter-spacing: -1px;
            }
            .sid-number.warn   { color: #ff6b00; text-shadow: 0 0 28px rgba(255,107,0,.4); }
            .sid-number.danger { color: #ff2244; text-shadow: 0 0 28px rgba(255,34,68,.45); }
            .sid-number.sid-pulse { animation: sid-pulse .35s cubic-bezier(.22,1,.36,1); }
            .sid-unit {
                font-size: 8px;
                color: #5a6a85;
                letter-spacing: .06em;
                line-height: 1;
                padding-bottom: 3px;
            }
            .sid-divider {
                height: 1px;
                background: #1e2535;
                margin: 5px 0;
                border-radius: 99px;
            }
            .sid-status {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 0px;
            }
            .sid-dot {
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: #00c8ff;
                box-shadow: 0 0 6px rgba(0,200,255,.7);
                animation: sid-blink 1.4s ease-in-out infinite;
                flex-shrink: 0;
                transition: background .3s, box-shadow .3s;
            }
            .sid-dot.warn   { background: #ff6b00; box-shadow: 0 0 6px rgba(255,107,0,.7); }
            .sid-dot.danger { background: #ff2244; box-shadow: 0 0 6px rgba(255,34,68,.8); animation: sid-blink-fast .7s ease-in-out infinite; }
            .sid-status-text {
                font-size: 7px;
                color: #5a6a85;
                letter-spacing: .08em;
                text-transform: uppercase;
            }
            .sid-hint {
                font-size: 7px;
                color: #2a3448;
                letter-spacing: .08em;
                text-transform: uppercase;
                margin-top: 5px;
                text-align: right;
                transition: color .2s;
            }
            #sid-balloon:hover .sid-hint { color: #5a6a85; }
            .sid-timer {
                position: absolute;
                bottom: 0; left: 0; right: 0;
                height: 3px;
                overflow: hidden;
            }
            .sid-timer-bar {
                height: 100%;
                width: 100%;
                background: #00c8ff;
                transform-origin: left;
                animation: sid-shrink 10s linear forwards;
                transition: background .3s;
            }
            .sid-timer-bar.warn   { background: #ff6b00; }
            .sid-timer-bar.danger { background: #ff2244; }
            @keyframes sid-slideIn {
                from { opacity: 0; transform: translateY(-14px) scale(.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes sid-slideOut {
                from { opacity: 1; transform: scale(1); }
                to   { opacity: 0; transform: translateY(-10px) scale(.96); }
            }
            @keyframes sid-shrink {
                from { transform: scaleX(1); }
                to   { transform: scaleX(0); }
            }
            @keyframes sid-pulse {
                0%   { transform: scale(1); }
                40%  { transform: scale(1.12); }
                100% { transform: scale(1); }
            }
            @keyframes sid-blink {
                0%, 100% { opacity: 1; }
                50%      { opacity: .35; }
            }
            @keyframes sid-blink-fast {
                0%, 100% { opacity: 1; }
                50%      { opacity: .2; }
            }
        `;
        document.head.appendChild(style);
        inicializarDesbloqueioAudio();
    }

    // -----------------------------
    // 🔵 BALÃO FLUTUANTE
    // -----------------------------

    let balloon = null;
    let autoCloseTimer = null;

    function colorClass(n) {
        if (n >= 10) return 'danger';
        if (n >= 5)  return 'warn';
        return '';
    }

    function statusText(n) {
        if (n === 0)  return 'FILA LIMPA';
        if (n >= 10)  return 'NIVEL CRITICO';
        if (n >= 5)   return 'ATENCAO';
        return 'MONITORANDO';
    }

    async function mostrarBalao() {
        if (balloon) fecharBalao(true);

        injetarEstilos();

        const estado = await carregarEstado();
        const valorReal = estado && estado.chamados
            ? Object.keys(estado.chamados).length
            : valorAnterior;

        const cls = colorClass(valorReal);

        balloon = document.createElement('div');
        balloon.id = 'sid-balloon';
        balloon.title = 'Abrir fila de incidentes';
        balloon.innerHTML = `
            <div class="sid-tag">SIDINEYA · NOC</div>
            <div class="sid-row-number">
                <div class="sid-number ${cls}">${valorReal}</div>
                <div class="sid-unit">chamados<br>na fila</div>
            </div>
            <div class="sid-divider"></div>
            <div class="sid-status">
                <div class="sid-dot ${cls}"></div>
                <div class="sid-status-text">${statusText(valorReal)}</div>
            </div>
            <div class="sid-hint">alt+4 fechar · clique p/ abrir</div>
            <div class="sid-timer"><div class="sid-timer-bar ${cls}"></div></div>
        `;

        balloon.addEventListener('click', () => {
            window.open(CONFIG.filaUrl, '_blank');
            fecharBalao();
        });

        document.body.appendChild(balloon);
        autoCloseTimer = setTimeout(fecharBalao, 10000);
    }

    function fecharBalao(imediato = false) {
        if (!balloon) return;
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;

        if (imediato) {
            balloon.remove();
            balloon = null;
            return;
        }

        balloon.classList.add('leaving');
        balloon.addEventListener('animationend', () => {
            balloon?.remove();
            balloon = null;
        }, { once: true });
    }

    function atualizarBalao(n) {
        if (!balloon) return;
        const numEl = balloon.querySelector('.sid-number');
        const barEl = balloon.querySelector('.sid-timer-bar');
        const dotEl = balloon.querySelector('.sid-dot');
        const stEl  = balloon.querySelector('.sid-status-text');
        const cls   = colorClass(n);

        numEl.textContent = n;
        numEl.className   = `sid-number ${cls}`;
        barEl.className   = `sid-timer-bar ${cls}`;
        dotEl.className   = `sid-dot ${cls}`;
        stEl.textContent  = statusText(n);

        numEl.classList.remove('sid-pulse');
        void numEl.offsetWidth;
        numEl.classList.add('sid-pulse');
    }

    document.addEventListener('keydown', e => {
        if (e.altKey && e.key === '4') {
            e.preventDefault();
            balloon ? fecharBalao() : mostrarBalao();
        }
    });

    // -----------------------------
    // 🎧 FILA DE ÁUDIO
    // -----------------------------

    let speechQueue = [];
    let isSpeaking = false;
    let audioCtx = null;
    const bufferCache = new Map();

    function baixarBuffer(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                onload: r => (r.status >= 200 && r.status < 300)
                    ? resolve(r.response)
                    : reject(new Error('HTTP ' + r.status)),
                onerror: () => reject(new Error('falha de rede')),
                ontimeout: () => reject(new Error('timeout'))
            });
        });
    }

    async function obterBuffer(url) {
        if (bufferCache.has(url)) return bufferCache.get(url);
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const bruto = await baixarBuffer(url);
        const decodificado = await audioCtx.decodeAudioData(bruto);
        bufferCache.set(url, decodificado);
        return decodificado;
    }

    async function tocarAudio(caminho) {
        const url = CONFIG.assetBase + caminho;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') await audioCtx.resume();

            const buffer = await obterBuffer(url);
            const fonte = audioCtx.createBufferSource();
            fonte.buffer = buffer;
            fonte.connect(audioCtx.destination);
            fonte.start();
        } catch (err) {
            console.warn('[SIDINEYA] Web Audio falhou, tentando <audio>:', caminho, err);
            new Audio(url).play().catch(e =>
                console.error('[SIDINEYA] Erro ao tocar áudio:', caminho, e)
            );
        }
    }

    function enfileirarFala(entry) {
        if (!entry) return;
        speechQueue.push(entry);
        if (!isSpeaking) processarFila();
    }

    async function processarFila() {
        if (speechQueue.length === 0) {
            isSpeaking = false;
            return;
        }
        isSpeaking = true;
        const entry = speechQueue.shift();
        if (typeof entry === "function") {
            await entry();
        } else {
            tocarAudio(entry);
        }
        setTimeout(processarFila, 2500);
    }

    function tocarAudioQuantidade(n) {
        const mapa = {
            1:  "audio/quantidade/umchamadonafila.mp3",
            2:  "audio/quantidade/doischamadosnafila.mp3",
            3:  "audio/quantidade/treschamadosnafila.mp3",
            4:  "audio/quantidade/quatrochamadosnafila.mp3",
            5:  "audio/quantidade/cincochamadosnafila.mp3",
            6:  "audio/quantidade/seischamadosnafila.mp3",
            7:  "audio/quantidade/setechamadosnafila.mp3",
            8:  "audio/quantidade/oitochamadosnafila.mp3",
            9:  "audio/quantidade/novechamadosnafila.mp3",
            10: "audio/quantidade/dezchamadosnafila.mp3"
        };
        tocarAudio(mapa[n] || "audio/quantidade/maisdedezchamadosnafila.mp3");
    }

    function audioChamadosAumentaram(qtd) {
        enfileirarFala("audio/base/novo_chamado.mp3");
        enfileirarFala(() => tocarAudioQuantidade(qtd));
    }

    function audioChamadosDiminuiram(qtd) {
        enfileirarFala("audio/base/filaatualizada.mp3");
        if (qtd > 0) enfileirarFala(() => tocarAudioQuantidade(qtd));
    }

    function audioFilaZerada() {
        enfileirarFala("audio/base/filazerada.mp3");
    }

    // -----------------------------
    // 💾 PERSISTÊNCIA DE ESTADO
    // -----------------------------

    async function salvarEstado(chamados) {
        try {
            GM_setValue(CONFIG.storageKey, { chamados, salvadoEm: Date.now() });
        } catch (err) {
            console.error("[SIDINEYA] Erro ao salvar estado:", err);
        }
    }

    async function carregarEstado() {
        try {
            return GM_getValue(CONFIG.storageKey, null);
        } catch (err) {
            console.error("[SIDINEYA] Erro ao carregar estado:", err);
            return null;
        }
    }

    async function limparEstado() {
        try {
            GM_deleteValue(CONFIG.storageKey);
        } catch (err) {
            console.error("[SIDINEYA] Erro ao limpar estado:", err);
        }
    }

    // -----------------------------
    // ⏱️ RASTREAMENTO POR ID DE CHAMADO
    // -----------------------------

    let chamadosAtivos = new Map();
    let estadoRestaurado = false;
    let ultimoReavisoEm = 0;

    function dispararReaviso(caminho) {
        const agora = Date.now();
        if (agora - ultimoReavisoEm < CONFIG.gateReavisoMs) return;
        ultimoReavisoEm = agora;
        enfileirarFala(caminho);
    }

    function registrarChamado(id, timestampEntrada) {
        if (chamadosAtivos.has(id)) return;
        const agora = Date.now();
        const decorrido = agora - timestampEntrada;
        const timers = [];

        CONFIG.reavisoMarcos.forEach(minuto => {
            const msMarco   = minuto * 60 * 1000;
            const msRestante = msMarco - decorrido;

            if (msRestante <= 0) {
                if (minuto === 13) dispararReaviso("audio/reaviso/alertacritico.mp3");
                return;
            }

            const t = setTimeout(() => {
                if (!chamadosAtivos.has(id)) return;
                if (minuto === 13) {
                    dispararReaviso("audio/reaviso/alertacritico.mp3");
                } else {
                    dispararReaviso("audio/reaviso/chamadosacumulados.mp3");
                }
            }, msRestante);

            timers.push(t);
        });

        chamadosAtivos.set(id, { entrou: timestampEntrada, timers });
    }

    function removerChamado(id) {
        const entry = chamadosAtivos.get(id);
        if (!entry) return;
        entry.timers.forEach(t => clearTimeout(t));
        chamadosAtivos.delete(id);
    }

    function destruirTodosChamados() {
        chamadosAtivos.forEach(entry => entry.timers.forEach(t => clearTimeout(t)));
        chamadosAtivos.clear();
    }

    function snapshotChamados() {
        const obj = {};
        chamadosAtivos.forEach((entry, id) => { obj[id] = entry.entrou; });
        return obj;
    }

    // -----------------------------
    // 🔄 REFRESH ALEATÓRIO (fila = 0) [4, 7 ou 9 min]
    // -----------------------------

    let refreshTimer = null;

    function iniciarRefreshTimer() {
        cancelarRefreshTimer();
        
        // Escolhe randomicamente entre 4, 7 ou 9 minutos
        const minutosAleatorios = CONFIG.refreshOpcoesMinutos[Math.floor(Math.random() * CONFIG.refreshOpcoesMinutos.length)];
        const intervaloMs = minutosAleatorios * 60 * 1000;

        console.log(`[SIDINEYA] Fila zerada. Recarregando a página em ${minutosAleatorios} minutos (${intervaloMs}ms).`);
        
        refreshTimer = setTimeout(() => {
            location.reload();
        }, intervaloMs);
    }

    function cancelarRefreshTimer() {
        if (refreshTimer) { 
            clearTimeout(refreshTimer); 
            refreshTimer = null; 
            console.log("[SIDINEYA] Fila > 0: Timer de recarregamento cancelado.");
        }
    }

    // -----------------------------
    // 🧠 DEBOUNCE INTELIGENTE
    // -----------------------------

    let debounceTimer = null;
    let valorPendente = null;
    let valorAnterior = 0;

    function processarMudanca(novoValor) {
        if (novoValor <= CONFIG.limiteRealtime) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
                valorPendente = null;
            }
            aplicarMudanca(novoValor);
            return;
        }

        const subindo = novoValor > valorAnterior;
        const delay   = subindo ? CONFIG.debounceSubida : CONFIG.debounceDescida;

        valorPendente = novoValor;
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            const pendente = valorPendente;
            valorPendente  = null;
            aplicarMudanca(pendente);
        }, delay);
    }

    // -----------------------------
    // 🔁 APLICAR MUDANÇA
    // -----------------------------

    function aplicarMudanca(novoValor) {
        const anterior = valorAnterior;
        if (novoValor === anterior) return;

        if (novoValor > anterior) {
            if (!estadoRestaurado) {
                const novosCount = novoValor - anterior;
                const agora = Date.now();
                for (let i = 0; i < novosCount; i++) {
                    registrarChamado(`sid_${agora}_${i}`, agora);
                }
            }
            audioChamadosAumentaram(novoValor);
            cancelarRefreshTimer(); // Fila subiu, cancela o refresh automático

        } else if (novoValor === 0) {
            destruirTodosChamados();
            audioFilaZerada();
            limparEstado();
            iniciarRefreshTimer(); // Fila zerou, agenda o refresh randômico (4, 7 ou 9 min)

        } else {
            const removidos = anterior - novoValor;
            const idsOrdenados = [...chamadosAtivos.entries()]
                .sort((a, b) => a[1].entrou - b[1].entrou)
                .map(([id]) => id);

            for (let i = 0; i < removidos && i < idsOrdenados.length; i++) {
                removerChamado(idsOrdenados[i]);
            }
            audioChamadosDiminuiram(novoValor);
            cancelarRefreshTimer(); // Ainda tem chamados (>0), cancela qualquer refresh pendente
        }

        estadoRestaurado = false;
        valorAnterior    = novoValor;
        salvarEstado(snapshotChamados());

        atualizarBalao(novoValor);
    }

    // -----------------------------
    // 🔢 PARSER DO ELEMENTO
    // -----------------------------

    function extrairValor(el) {
        const raw    = el.textContent.trim();
        const numero = Number(raw);
        if (isNaN(numero)) {
            console.warn("[SIDINEYA] Valor inválido detectado:", raw);
            return 0;
        }
        return numero;
    }

    // -----------------------------
    // 🔍 OBSERVAÇÃO DO ELEMENTO
    // -----------------------------

    let observerStarted = false;

    async function monitorarElemento(el) {
        if (observerStarted) return;
        observerStarted = true;

        const getValorAtual = () => extrairValor(el);
        const estado = await carregarEstado();

        if (estado && estado.chamados) {
            const ids = Object.keys(estado.chamados);
            ids.forEach(id => registrarChamado(id, estado.chamados[id]));
            valorAnterior    = ids.length;
            estadoRestaurado = true;
            console.log(`[SIDINEYA] Estado recuperado: ${ids.length} chamado(s) ativos.`);
        }

        const valorInicial = getValorAtual();
        valorAnterior = valorInicial; // Sincroniza o valor inicial real da tela

        if (valorInicial === 0 && chamadosAtivos.size === 0) {
            iniciarRefreshTimer();
        } else {
            cancelarRefreshTimer();
        }

        const observer = new MutationObserver(() => {
            const atual = getValorAtual();
            if (atual !== valorAnterior) processarMudanca(atual);
        });

        observer.observe(el, { childList: true, subtree: true, characterData: true });
    }

    // -----------------------------
    // ⏳ AGUARDAR ELEMENTO NA TELA
    // -----------------------------

    function esperarElemento(selector, callback, tentativas = 30) {
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                callback(el);
            } else if (--tentativas <= 0) {
                clearInterval(timer);
                console.warn("[SIDINEYA] Elemento não encontrado — esta página não tem o seletor monitorado (normal em páginas secundárias).");
            }
        }, 2000);
    }

    esperarElemento(CONFIG.checkSelector, monitorarElemento);

})();

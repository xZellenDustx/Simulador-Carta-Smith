// Clase principal del Analizador de Carta de Smith
class SmithChartProfessional {
    constructor() {
        // Configuración inicial
        this.config = {
            canvasSize: 800,
            center: 400,
            radius: 350,
            backgroundColor: '#f8f9fa',
            circleColor: '#2c3e50',
            resistanceColor: '#e74c3c',
            reactanceColor: '#3498db',
            vswrColor: '#2ecc71',
            rotationColor: '#9b59b6',
            g1CircleColor: '#f39c12',
            gridColor: '#e0e0e0'
        };

        // Estado
        this.history = [];
        this.currentAnnotations = [];
        this.currentPlots = [];
        this.canvas = document.getElementById('smithChart');
        this.ctx = this.canvas.getContext('2d');
        this.resultsText = document.getElementById('resultsText');

        // Inicializar sistema de trazado
        this.tracingSystem = {
            steps: [],
            currentStep: 0,
            isTracing: false,
            animationSpeed: 50,
            animationInterval: null
        };

        // Inicializar coordenadas del mouse
        this.mouseCoords = { x: 0, y: 0, gamma: { real: 0, imag: 0 }, z: { real: 0, imag: 0 } };

        // Inicializar
        this.init();
        this.drawSmithChart();
        this.addDetailedFeatures();
    }

    init() {
        // Event listeners para botones
        document.getElementById('calcZin').addEventListener('click', () => this.onCalculateZin());
        document.getElementById('calcStub').addEventListener('click', () => this.onDesignStub());
        document.getElementById('calcQuick').addEventListener('click', () => this.onCalculateQuick());
        document.getElementById('clear').addEventListener('click', () => this.onClear());
        document.getElementById('showHistory').addEventListener('click', () => this.onShowHistory());
        document.getElementById('export').addEventListener('click', () => this.onExport());
        document.getElementById('help').addEventListener('click', () => this.onShowHelp());
        
        // Event listeners para modales
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            });
        });

        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (event) => {
            document.querySelectorAll('.modal').forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Event listeners para botones del modal de historial
        document.getElementById('exportHistory')?.addEventListener('click', () => this.exportHistory());
        document.getElementById('clearHistory')?.addEventListener('click', () => this.clearHistory());
    }

    addDetailedFeatures() {
        // Sistema de coordenadas del mouse
        this.setupMouseTracking();

        // Panel de trazado
        this.createTracingPanel();
    }

    // ====================== FUNCIONES MATEMÁTICAS ======================
    parseComplex(str) {
        str = str.replace(/\s+/g, '').toLowerCase();
        
        if (str === 'inf') return { real: Infinity, imag: 0 };
        if (str === '0' || str === '0j') return { real: 0, imag: 0 };
        
        const match = str.match(/^([+-]?\d*\.?\d*)(?:([+-]?\d*\.?\d*)j)?$/);
        if (!match) throw new Error('Formato complejo inválido');
        
        const real = match[1] ? parseFloat(match[1]) : 0;
        const imag = match[2] ? parseFloat(match[2]) : 0;
        
        return { real, imag };
    }

    complexToString(z) {
        if (Math.abs(z.real) === Infinity) return "∞";
        if (z.real === 0 && z.imag === 0) return "0";
        
        let result = "";
        if (z.real !== 0) result += z.real.toFixed(2);
        if (z.imag !== 0) {
            if (z.imag > 0 && z.real !== 0) result += "+";
            result += z.imag.toFixed(2) + "j";
        }
        return result || "0";
    }

    complexAdd(a, b) {
        return { real: a.real + b.real, imag: a.imag + b.imag };
    }

    complexSubtract(a, b) {
        return { real: a.real - b.real, imag: a.imag - b.imag };
    }

    complexMultiply(a, b) {
        return {
            real: a.real * b.real - a.imag * b.imag,
            imag: a.real * b.imag + a.imag * b.real
        };
    }

    complexDivide(a, b) {
        const denom = b.real * b.real + b.imag * b.imag;
        return {
            real: (a.real * b.real + a.imag * b.imag) / denom,
            imag: (a.imag * b.real - a.real * b.imag) / denom
        };
    }

    complexMagnitude(z) {
        return Math.sqrt(z.real * z.real + z.imag * z.imag);
    }

    complexAngle(z) {
        return Math.atan2(z.imag, z.real);
    }

    complexExp(theta) {
        return { real: Math.cos(theta), imag: Math.sin(theta) };
    }

    zToGamma(z, z0 = 50) {
        const zNorm = this.complexDivide(z, { real: z0, imag: 0 });
        const num = this.complexSubtract(zNorm, { real: 1, imag: 0 });
        const den = this.complexAdd(zNorm, { real: 1, imag: 0 });
        return this.complexDivide(num, den);
    }

    gammaToZ(gamma, z0 = 50) {
        const num = this.complexAdd({ real: 1, imag: 0 }, gamma);
        const den = this.complexSubtract({ real: 1, imag: 0 }, gamma);
        const zNorm = this.complexDivide(num, den);
        return this.complexMultiply(zNorm, { real: z0, imag: 0 });
    }

    // ====================== DIBUJO DE CARTA DE SMITH ======================
    drawSmithChart() {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;

        // Limpiar canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Fondo
        ctx.fillStyle = this.config.backgroundColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Cuadrícula sutil
        ctx.strokeStyle = this.config.gridColor;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(0, center - radius + (i * radius * 0.2));
            ctx.lineTo(this.canvas.width, center - radius + (i * radius * 0.2));
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(center - radius + (i * radius * 0.2), 0);
            ctx.lineTo(center - radius + (i * radius * 0.2), this.canvas.height);
            ctx.stroke();
        }

        // Círculo exterior (|Γ|=1)
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.config.circleColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Círculos de resistencia constante
        const resistances = [0.2, 0.5, 1, 2, 5];
        ctx.strokeStyle = this.config.resistanceColor;
        ctx.lineWidth = 1;
        
        resistances.forEach(r => {
            const centerX = center + (r / (r + 1)) * radius;
            const circleRadius = (1 / (r + 1)) * radius;
            
            ctx.beginPath();
            ctx.arc(centerX, center, circleRadius, 0, Math.PI * 2);
            ctx.setLineDash(r === 1 ? [] : [5, 5]);
            ctx.stroke();
        });

        // Arcos de reactancia constante
        const reactances = [0.2, 0.5, 1, 2, 5];
        ctx.strokeStyle = this.config.reactanceColor;
        
        reactances.forEach(x => {
            [1, -1].forEach(sign => {
                const centerY = center + sign * (1 / x) * radius;
                const arcRadius = (1 / x) * radius;
                
                ctx.beginPath();
                ctx.arc(center + radius, centerY, arcRadius, Math.PI / 2, Math.PI * 1.5);
                ctx.setLineDash([5, 5]);
                ctx.stroke();
            });
        });

        ctx.setLineDash([]);

        // Eje real
        ctx.beginPath();
        ctx.moveTo(center - radius, center);
        ctx.lineTo(center + radius, center);
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Puntos especiales
        this.drawPoint({ real: -1, imag: 0 }, 'SC', '#ffcccc', 'circle');
        this.drawPoint({ real: 1, imag: 0 }, 'OC', '#ccffcc', 'circle');

        // Escala angular
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 0.5;
        ctx.font = '10px Arial';
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let angle = 0; angle < 360; angle += 30) {
            const rad = angle * Math.PI / 180;
            const x1 = center + 0.95 * radius * Math.cos(rad);
            const y1 = center + 0.95 * radius * Math.sin(rad);
            const x2 = center + radius * Math.cos(rad);
            const y2 = center + radius * Math.sin(rad);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            if (angle % 90 === 0) {
                const labelX = center + 1.07 * radius * Math.cos(rad);
                const labelY = center + 1.07 * radius * Math.sin(rad);
                
                ctx.save();
                ctx.translate(labelX, labelY);
                ctx.rotate(rad + Math.PI / 2);
                ctx.fillText(`${angle}°`, 0, 0);
                ctx.restore();
            }
        }
    }

    gammaToCanvas(gamma) {
        const center = this.config.center;
        const radius = this.config.radius;
        return {
            x: center + gamma.real * radius,
            y: center - gamma.imag * radius
        };
    }

    drawPoint(gamma, label, color, marker = 'circle') {
        const ctx = this.ctx;
        const coords = this.gammaToCanvas(gamma);
        
        ctx.save();
        
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        
        switch(marker) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(coords.x, coords.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;
            case 'square':
                ctx.fillRect(coords.x - 8, coords.y - 8, 16, 16);
                ctx.strokeRect(coords.x - 8, coords.y - 8, 16, 16);
                break;
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y - 10);
                ctx.lineTo(coords.x - 9, coords.y + 7);
                ctx.lineTo(coords.x + 9, coords.y + 7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            case 'star':
                this.drawStar(ctx, coords.x, coords.y, 5, 10, 5);
                break;
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(this.config.center, this.config.center);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        
        const textOffset = 20;
        const angle = Math.atan2(this.config.center - coords.y, coords.x - this.config.center);
        let ha, va, offsetX, offsetY;
        
        if (Math.abs(angle) < Math.PI / 4) {
            ha = 'left';
            offsetX = textOffset;
        } else if (Math.abs(angle) > 3 * Math.PI / 4) {
            ha = 'right';
            offsetX = -textOffset;
        } else {
            ha = 'center';
            offsetX = 0;
        }
        
        if (angle > Math.PI / 4 && angle < 3 * Math.PI / 4) {
            va = 'top';
            offsetY = -textOffset;
        } else if (angle < -Math.PI / 4 && angle > -3 * Math.PI / 4) {
            va = 'bottom';
            offsetY = textOffset;
        } else {
            va = 'middle';
            offsetY = 0;
        }
        
        const magnitude = this.complexMagnitude(gamma);
        const angleDeg = this.complexAngle(gamma) * 180 / Math.PI;
        
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = ha;
        ctx.textBaseline = va;
        ctx.fillStyle = color;
        ctx.fillText(label, coords.x + offsetX, coords.y + offsetY);
        
        ctx.font = '10px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(`|Γ|=${magnitude.toFixed(2)}`, coords.x + offsetX, coords.y + offsetY + 15);
        
        ctx.restore();
        
        this.currentAnnotations.push({
            type: 'point',
            gamma,
            label,
            color,
            marker
        });
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawSWRConstantCircle(gamma) {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;
        const gammaRadius = this.complexMagnitude(gamma);
        
        ctx.save();
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(center, center, gammaRadius * radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        const vswr = (1 + gammaRadius) / (1 - gammaRadius);
        ctx.fillStyle = '#2ecc71';
        ctx.font = '12px Arial';
        ctx.fillText(`VSWR: ${vswr.toFixed(2)}`, center + 10, center - (gammaRadius * radius) - 10);
        
        ctx.restore();
    }

    drawVSWRCircle(gamma, color) {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;
        const gammaRadius = this.complexMagnitude(gamma);
        
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(center, center, gammaRadius * radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        
        ctx.restore();
        
        const vswr = (1 + gammaRadius) / (1 - gammaRadius);
        const labelAngle = this.complexAngle(gamma) + Math.PI / 4;
        const labelX = center + gammaRadius * radius * Math.cos(labelAngle) * 0.7;
        const labelY = center - gammaRadius * radius * Math.sin(labelAngle) * 0.7;
        
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`VSWR=${vswr.toFixed(2)}`, labelX, labelY);
        ctx.restore();
        
        this.currentAnnotations.push({
            type: 'vswr',
            gamma,
            color
        });
        
        return vswr;
    }

    // ====================== NUEVAS FUNCIONALIDADES ======================
    setupMouseTracking() {
        const canvas = this.canvas;
        
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const gamma = this.canvasToGamma(x, y);
            const z = this.gammaToZ(gamma, parseFloat(document.getElementById('z0').value) || 50);
            
            this.mouseCoords = { x, y, gamma, z };
            this.updateCoordinatesDisplay();
        });
    }

    canvasToGamma(x, y) {
        const center = this.config.center;
        const radius = this.config.radius;
        
        const gammaX = (x - center) / radius;
        const gammaY = -(y - center) / radius;
        
        const magnitude = Math.sqrt(gammaX * gammaX + gammaY * gammaY);
        
        if (magnitude > 1) {
            return {
                real: gammaX / magnitude,
                imag: gammaY / magnitude
            };
        }
        
        return { real: gammaX, imag: gammaY };
    }

    updateCoordinatesDisplay() {
        let display = document.getElementById('coordinatesDisplay');
        
        if (!display) {
            display = document.createElement('div');
            display.id = 'coordinatesDisplay';
            display.className = 'coordinates-display';
            document.querySelector('.chart-container').appendChild(display);
        }
        
        const { gamma, z } = this.mouseCoords;
        const magGamma = this.complexMagnitude(gamma);
        const angleGamma = this.complexAngle(gamma) * 180 / Math.PI;
        const z0 = parseFloat(document.getElementById('z0').value) || 50;
        
        // Calcular admitancia
        let yReal = '∞', yImag = '0';
        if (z.real !== 0 || z.imag !== 0) {
            const denominator = z.real * z.real + z.imag * z.imag;
            yReal = (z.real / denominator).toFixed(3);
            yImag = (-z.imag / denominator).toFixed(3);
        }
        
        display.innerHTML = `
            <div class="coord-title">COORDENADAS DEL PUNTO</div>
            <div class="coord-values">
                <div>
                    <div>Γ = ${gamma.real.toFixed(3)} + ${gamma.imag.toFixed(3)}j</div>
                    <div>|Γ|∠θ = ${magGamma.toFixed(3)}∠${angleGamma.toFixed(1)}°</div>
                </div>
                <div>
                    <div>Z = ${z.real.toFixed(1)} + ${z.imag.toFixed(1)}j Ω</div>
                    <div>Y = ${yReal} + ${yImag}j S</div>
                </div>
            </div>
        `;
        
        // Posicionar el display
        const rect = this.canvas.getBoundingClientRect();
        const containerRect = document.querySelector('.chart-container').getBoundingClientRect();
        
        let left = this.mouseCoords.x + rect.left - containerRect.left + 15;
        let top = this.mouseCoords.y + rect.top - containerRect.top + 15;
        
        // Asegurar que no salga del contenedor
        if (left + 250 > containerRect.width) left -= 280;
        if (top + 100 > containerRect.height) top -= 120;
        
        display.style.left = left + 'px';
        display.style.top = top + 'px';
    }

    createTracingPanel() {
        const panel = document.createElement('div');
        panel.className = 'tracing-panel';
        panel.innerHTML = `
            <h4><i class="fas fa-map-marked-alt"></i> TRAZADO DE ROTACIÓN</h4>
            <div class="tracing-info">
                <div class="tracing-item">
                    <span class="tracing-label">PASOS:</span>
                    <span class="tracing-value" id="stepCount">0/0</span>
                </div>
                <div class="tracing-item">
                    <span class="tracing-label">DISTANCIA:</span>
                    <span class="tracing-value" id="rotationDistance">0 λ</span>
                </div>
                <div class="tracing-item">
                    <span class="tracing-label">ÁNGULO:</span>
                    <span class="tracing-value" id="rotationAngle">0°</span>
                </div>
                <div class="rotation-progress">
                    <div class="progress-fill" id="rotationProgress"></div>
                </div>
            </div>
            <div class="animation-controls">
                <button class="anim-btn" id="startAnimation">
                    <i class="fas fa-play"></i> INICIAR
                </button>
                <button class="anim-btn pause" id="pauseAnimation" style="display: none;">
                    <i class="fas fa-pause"></i> PAUSAR
                </button>
                <button class="anim-btn" id="resetAnimation">
                    <i class="fas fa-redo"></i> REINICIAR
                </button>
            </div>
        `;
        
        document.querySelector('.chart-container').appendChild(panel);
        
        document.getElementById('startAnimation').addEventListener('click', () => this.startAnimation());
        document.getElementById('pauseAnimation').addEventListener('click', () => this.pauseAnimation());
        document.getElementById('resetAnimation').addEventListener('click', () => this.resetAnimation());
    }

    // ====================== SISTEMA DE TRAZADO PASO A PASO ======================
    setupTracingSteps(gammaStart, gammaEnd, steps = 20) {
        this.tracingSystem.steps = [];
        
        const startAngle = this.complexAngle(gammaStart);
        const endAngle = this.complexAngle(gammaEnd);
        const magnitude = this.complexMagnitude(gammaStart);
        
        let angleDiff = endAngle - startAngle;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const currentAngle = startAngle + angleDiff * progress;
            
            const gamma = {
                real: magnitude * Math.cos(currentAngle),
                imag: magnitude * Math.sin(currentAngle)
            };
            
            this.tracingSystem.steps.push({
                gamma,
                angle: currentAngle,
                progress,
                distanceLambda: progress * Math.abs(angleDiff) / (2 * Math.PI),
                angleDeg: currentAngle * 180 / Math.PI
            });
        }
        
        this.tracingSystem.currentStep = 0;
        this.updateTracingPanel();
    }

    startAnimation() {
        if (this.tracingSystem.isTracing || this.tracingSystem.steps.length === 0) return;
        
        this.tracingSystem.isTracing = true;
        document.getElementById('startAnimation').style.display = 'none';
        document.getElementById('pauseAnimation').style.display = 'flex';
        
        this.tracingSystem.animationInterval = setInterval(() => {
            this.tracingSystem.currentStep++;
            this.drawCurrentStep();
            this.updateTracingPanel();
            
            if (this.tracingSystem.currentStep >= this.tracingSystem.steps.length) {
                this.pauseAnimation();
            }
        }, this.tracingSystem.animationSpeed);
    }

    pauseAnimation() {
        this.tracingSystem.isTracing = false;
        clearInterval(this.tracingSystem.animationInterval);
        document.getElementById('startAnimation').style.display = 'flex';
        document.getElementById('pauseAnimation').style.display = 'none';
    }

    resetAnimation() {
        this.pauseAnimation();
        this.tracingSystem.currentStep = 0;
        this.drawCurrentStep();
        this.updateTracingPanel();
    }

    drawCurrentStep() {
        if (this.tracingSystem.currentStep === 0) return;
        
        const step = this.tracingSystem.steps[this.tracingSystem.currentStep];
        const prevStep = this.tracingSystem.steps[this.tracingSystem.currentStep - 1];
        
        this.drawRotationSegment(prevStep.gamma, step.gamma);
        this.drawStepIndicator(step);
    }

    drawRotationSegment(gamma1, gamma2) {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;
        
        const magnitude = this.complexMagnitude(gamma1);
        const angle1 = Math.atan2(-gamma1.imag, gamma1.real);
        const angle2 = Math.atan2(-gamma2.imag, gamma2.real);
        
        ctx.save();
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.8;
        
        ctx.beginPath();
        ctx.arc(center, center, magnitude * radius, angle1, angle2, false);
        ctx.stroke();
        
        const midAngle = (angle1 + angle2) / 2;
        const arrowX = center + magnitude * radius * Math.cos(midAngle);
        const arrowY = center - magnitude * radius * Math.sin(midAngle);
        
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(midAngle + Math.PI / 2);
        
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-6, -12);
        ctx.lineTo(6, -12);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        ctx.restore();
    }

    drawStepIndicator(step) {
        const coords = this.gammaToCanvas(step.gamma);
        
        const oldIndicator = document.getElementById('stepIndicator');
        if (oldIndicator) oldIndicator.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'stepIndicator';
        indicator.className = 'rotation-indicator';
        indicator.style.left = (coords.x + 20) + 'px';
        indicator.style.top = (coords.y - 30) + 'px';
        indicator.innerHTML = `
            <div>Paso: ${this.tracingSystem.currentStep}/${this.tracingSystem.steps.length}</div>
            <div>θ = ${step.angleDeg.toFixed(1)}°</div>
        `;
        
        document.querySelector('.chart-container').appendChild(indicator);
    }

    updateTracingPanel() {
        const stepCount = document.getElementById('stepCount');
        const rotationDistance = document.getElementById('rotationDistance');
        const rotationAngle = document.getElementById('rotationAngle');
        const progressFill = document.getElementById('rotationProgress');
        
        if (stepCount) {
            stepCount.textContent = `${this.tracingSystem.currentStep}/${this.tracingSystem.steps.length}`;
        }
        
        if (rotationDistance && this.tracingSystem.currentStep > 0) {
            const step = this.tracingSystem.steps[this.tracingSystem.currentStep];
            rotationDistance.textContent = `${step.distanceLambda.toFixed(3)} λ`;
        }
        
        if (rotationAngle && this.tracingSystem.currentStep > 0) {
            const step = this.tracingSystem.steps[this.tracingSystem.currentStep];
            rotationAngle.textContent = `${step.angleDeg.toFixed(1)}°`;
        }
        
        if (progressFill) {
            const progress = this.tracingSystem.currentStep / this.tracingSystem.steps.length * 100;
            progressFill.style.width = `${progress}%`;
        }
    }

    // ====================== FUNCIÓN MEJORADA PARA CALCULAR Zin ======================
    calculateZinDetailed(zl, z0, length_m, vp, freq_hz) {
        const wavelength = (vp * 3e8) / freq_hz;
        const beta = 2 * Math.PI / wavelength;
        const electricalLength = length_m / wavelength;
        
        const gamma_l = this.zToGamma(zl, z0);
        const gammaMag = this.complexMagnitude(gamma_l);
        
        const gamma_in = this.rotateGamma(gamma_l, -2 * beta * length_m);
        
        const zin = this.gammaToZ(gamma_in, z0);
        
        const vswr = gammaMag !== 1 ? (1 + gammaMag) / (1 - gammaMag) : Infinity;
        const returnLoss = -20 * Math.log10(gammaMag);
        const mismatchLoss = -10 * Math.log10(1 - Math.pow(gammaMag, 2));
        const rotationAngleDeg = (2 * beta * length_m * 180 / Math.PI) % 360;
        
        const intermediatePoints = [];
        const numPoints = 10;
        for (let i = 0; i <= numPoints; i++) {
            const angle = -2 * beta * length_m * (i / numPoints);
            intermediatePoints.push(this.rotateGamma(gamma_l, angle));
        }
        
        return {
            Zin: zin,
            Gamma_in: gamma_in,
            Gamma_l: gamma_l,
            VSWR: vswr,
            Wavelength: wavelength,
            Electrical_length: electricalLength,
            Beta: beta,
            ReturnLoss: returnLoss,
            MismatchLoss: mismatchLoss,
            RotationAngle: rotationAngleDeg,
            IntermediatePoints: intermediatePoints,
            GammaMagnitude: gammaMag,
            GammaAngle: this.complexAngle(gamma_l) * 180 / Math.PI
        };
    }

    rotateGamma(gamma, angle) {
        const magnitude = this.complexMagnitude(gamma);
        const currentAngle = this.complexAngle(gamma);
        const newAngle = currentAngle + angle;
        
        return {
            real: magnitude * Math.cos(newAngle),
            imag: magnitude * Math.sin(newAngle)
        };
    }

    interpolateGamma(gamma1, gamma2, factor) {
        const magnitude1 = this.complexMagnitude(gamma1);
        const magnitude2 = this.complexMagnitude(gamma2);
        const angle1 = this.complexAngle(gamma1);
        const angle2 = this.complexAngle(gamma2);
        
        let angleDiff = angle2 - angle1;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const magnitude = magnitude1 + factor * (magnitude2 - magnitude1);
        const angle = angle1 + factor * angleDiff;
        
        return {
            real: magnitude * Math.cos(angle),
            imag: magnitude * Math.sin(angle)
        };
    }

    interpolateColor(color1, color2, factor) {
        const hex = color => color.replace('#', '');
        const hexToRgb = hex => {
            const bigint = parseInt(hex, 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255
            };
        };
        
        const c1 = hexToRgb(hex(color1));
        const c2 = hexToRgb(hex(color2));
        
        const r = Math.round(c1.r + factor * (c2.r - c1.r));
        const g = Math.round(c1.g + factor * (c2.g - c1.g));
        const b = Math.round(c1.b + factor * (c2.b - c1.b));
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    // ====================== MANEJADORES DE EVENTOS ======================
    onCalculateZin() {
        this.onCalculateZinDetailed();
    }

    onCalculateZinDetailed() {
        try {
            const z0 = parseFloat(document.getElementById('z0').value);
            const zl = this.parseComplex(document.getElementById('zl').value);
            const freq_hz = parseFloat(document.getElementById('freq').value) * 1e6;
            const length_m = parseFloat(document.getElementById('length').value);
            const vp = parseFloat(document.getElementById('vp').value);
            
            if (isNaN(z0) || isNaN(freq_hz) || isNaN(length_m) || isNaN(vp)) {
                throw new Error('Valores inválidos. Verifique los campos.');
            }
            
            if (z0 <= 0) throw new Error('Z₀ debe ser mayor que 0');
            if (freq_hz <= 0) throw new Error('Frecuencia debe ser mayor que 0');
            if (length_m < 0) throw new Error('Longitud no puede ser negativa');
            if (vp <= 0 || vp > 1) throw new Error('Vp debe estar entre 0 y 1');
            
            const results = this.calculateZinDetailed(zl, z0, length_m, vp, freq_hz);
            
            this.currentAnnotations = [];
            this.drawSmithChart();
            
            this.drawCompleteTrace(zl, z0, results);
            
            this.setupTracingSteps(results.Gamma_l, results.Gamma_in, 50);
            
            this.showDetailedResults(results, { z0, zl, freq_hz, length_m, vp });
            
            this.addToHistory('Z_in', results, { z0, zl, freq_hz, length_m, vp });
            
        } catch (error) {
            this.showError(`Error en cálculo: ${error.message}`);
        }
    }

    drawCompleteTrace(zl, z0, results) {
        const ctx = this.ctx;
        
        this.drawPoint(results.Gamma_l, 'Z_L', '#e74c3c', 'circle');
        this.drawPoint(results.Gamma_in, 'Z_in', '#27ae60', 'triangle');
        
        const vswr = this.drawVSWRCircle(results.Gamma_l, '#3498db');
        
        results.IntermediatePoints.forEach((gamma, index) => {
            const progress = index / (results.IntermediatePoints.length - 1);
            const color = this.interpolateColor('#e74c3c', '#27ae60', progress);
            
            const coords = this.gammaToCanvas(gamma);
            ctx.save();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        
        this.drawRotationArrow(results.Gamma_l, results.Gamma_in);
        this.drawRotationAngle(results.Gamma_l, results.Gamma_in, results.RotationAngle);
        
        return vswr;
    }

    drawRotationArrow(gammaStart, gammaEnd) {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;
        
        const midPoint = this.interpolateGamma(gammaStart, gammaEnd, 0.5);
        const coords = this.gammaToCanvas(midPoint);
        
        const angle = Math.atan2(
            gammaEnd.imag - gammaStart.imag,
            gammaEnd.real - gammaStart.real
        );
        
        ctx.save();
        ctx.translate(coords.x, coords.y);
        ctx.rotate(-angle);
        
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    drawRotationAngle(gammaStart, gammaEnd, angleDeg) {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;
        
        const magnitude = this.complexMagnitude(gammaStart);
        const startAngle = Math.atan2(-gammaStart.imag, gammaStart.real);
        const endAngle = Math.atan2(-gammaEnd.imag, gammaEnd.real);
        
        const midAngle = (startAngle + endAngle) / 2;
        const labelRadius = magnitude * radius * 0.7;
        const labelX = center + labelRadius * Math.cos(midAngle);
        const labelY = center - labelRadius * Math.sin(midAngle);
        
        ctx.save();
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${angleDeg.toFixed(1)}°`, labelX, labelY);
        ctx.restore();
    }

    showDetailedResults(results, params) {
        const freqMHz = params.freq_hz / 1e6;
        
        let html = `
            <div class="results-title">ANÁLISIS DETALLADO DE LÍNEA</div>
            <div class="results-divider">══════════════════════════════════════════════</div>
            
            <div class="detailed-results">
                <div class="result-card">
                    <h5><i class="fas fa-bolt"></i> IMPEDANCIA DE ENTRADA</h5>
                    <div class="result-value">${results.Zin.real.toFixed(2)} + ${results.Zin.imag.toFixed(2)}j Ω</div>
                </div>
                
                <div class="result-card">
                    <h5><i class="fas fa-wave-square"></i> VSWR</h5>
                    <div class="result-value">${results.VSWR.toFixed(2)}:1</div>
                </div>
                
                <div class="result-card">
                    <h5><i class="fas fa-undo"></i> RETURN LOSS</h5>
                    <div class="result-value">${results.ReturnLoss.toFixed(2)} dB</div>
                </div>
                
                <div class="result-card">
                    <h5><i class="fas fa-exchange-alt"></i> PÉRDIDA DESACOPLE</h5>
                    <div class="result-value">${results.MismatchLoss.toFixed(2)} dB</div>
                </div>
                
                <div class="result-card">
                    <h5><i class="fas fa-ruler"></i> LONGITUD ELÉCTRICA</h5>
                    <div class="result-value">${results.Electrical_length.toFixed(3)} λ</div>
                </div>
                
                <div class="result-card">
                    <h5><i class="fas fa-rotate-right"></i> ROTACIÓN</h5>
                    <div class="result-value">${results.RotationAngle.toFixed(1)}°</div>
                </div>
            </div>
            
            <div class="impedance-grid">
                <div class="grid-item">
                    <div class="grid-label">Z₀</div>
                    <div class="grid-value">${params.z0.toFixed(1)} Ω</div>
                </div>
                <div class="grid-item">
                    <div class="grid-label">Z_L</div>
                    <div class="grid-value">${params.zl.real.toFixed(1)} + ${params.zl.imag.toFixed(1)}j Ω</div>
                </div>
                <div class="grid-item">
                    <div class="grid-label">f</div>
                    <div class="grid-value">${freqMHz.toFixed(1)} MHz</div>
                </div>
                <div class="grid-item">
                    <div class="grid-label">λ</div>
                    <div class="grid-value">${results.Wavelength.toFixed(4)} m</div>
                </div>
                <div class="grid-item">
                    <div class="grid-label">|Γ|</div>
                    <div class="grid-value">${results.GammaMagnitude.toFixed(3)}</div>
                </div>
                <div class="grid-item">
                    <div class="grid-label">∠Γ</div>
                    <div class="grid-value">${results.GammaAngle.toFixed(1)}°</div>
                </div>
            </div>
            
            <div class="steps-container">
                <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <div class="step-title">NORMALIZAR IMPEDANCIA</div>
                        <div class="step-description">
                            Z_norm = Z_L / Z₀ = ${(params.zl.real/params.z0).toFixed(2)} + ${(params.zl.imag/params.z0).toFixed(2)}j
                        </div>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <div class="step-title">CALCULAR COEFICIENTE DE REFLEXIÓN</div>
                        <div class="step-description">
                            Γ_L = ${results.Gamma_l.real.toFixed(3)} + ${results.Gamma_l.imag.toFixed(3)}j<br>
                            |Γ| = ${results.GammaMagnitude.toFixed(3)}, ∠ = ${results.GammaAngle.toFixed(1)}°
                        </div>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <div class="step-title">ROTAR HACIA EL GENERADOR</div>
                        <div class="step-description">
                            Γ_in = Γ_L × e^{-j2βl}<br>
                            βl = ${(results.Beta * params.length_m * 180/Math.PI).toFixed(1)}°<br>
                            Rotación total: 2βl = ${results.RotationAngle.toFixed(1)}°
                        </div>
                    </div>
                </div>
                
                <div class="step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <div class="step-title">CONVERTIR A IMPEDANCIA</div>
                        <div class="step-description">
                            Z_in = Z₀ × (1 + Γ_in) / (1 - Γ_in)<br>
                            Resultado: ${results.Zin.real.toFixed(2)} + ${results.Zin.imag.toFixed(2)}j Ω
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.resultsText.innerHTML = html;
    }

    addToHistory(type, results, params) {
        this.history.push({
            Tipo: type,
            Z0: params.z0.toFixed(1),
            ZL: `${params.zl.real.toFixed(1)}+${params.zl.imag.toFixed(1)}j`,
            Zin: `${results.Zin.real.toFixed(2)}+${results.Zin.imag.toFixed(2)}j`,
            VSWR: results.VSWR.toFixed(2),
            ReturnLoss: results.ReturnLoss.toFixed(2),
            Longitud_λ: results.Electrical_length.toFixed(3),
            Rotacion: `${results.RotationAngle.toFixed(1)}°`,
            Fecha: new Date().toLocaleString()
        });
    }

    onCalculateQuick() {
        try {
            const z0 = parseFloat(document.getElementById('z0').value);
            const zl = this.parseComplex(document.getElementById('zl').value);
            
            this.currentAnnotations = [];
            this.drawSmithChart();
            
            const gamma = this.zToGamma(zl, z0);
            this.drawPoint(gamma, 'Z_L', '#e74c3c', 'circle');
            
            let html = `
                <div class="results-title">IMPEDANCIA DE CARGA</div>
                <div class="results-divider">══════════════════════════════════════════════</div>
                
                <div class="detailed-results">
                    <div class="result-card">
                        <h5><i class="fas fa-weight-hanging"></i> Z_L</h5>
                        <div class="result-value">${zl.real.toFixed(2)} + ${zl.imag.toFixed(2)}j Ω</div>
                    </div>
                    
                    <div class="result-card">
                        <h5><i class="fas fa-chart-pie"></i> COEF. REFLEXIÓN</h5>
                        <div class="result-value">${gamma.real.toFixed(3)} + ${gamma.imag.toFixed(3)}j</div>
                    </div>
                    
                    <div class="result-card">
                        <h5><i class="fas fa-ruler-combined"></i> MAGNITUD |Γ|</h5>
                        <div class="result-value">${this.complexMagnitude(gamma).toFixed(3)}</div>
                    </div>
                    
                    <div class="result-card">
                        <h5><i class="fas fa-angle-right"></i> ÁNGULO ∠Γ</h5>
                        <div class="result-value">${(this.complexAngle(gamma) * 180/Math.PI).toFixed(1)}°</div>
                    </div>
                </div>
            `;
            
            this.resultsText.innerHTML = html;
            
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    // ====================== CÁLCULOS ANTERIORES ======================
    calculateZin(zl, z0, length_m, vp, freq_hz) {
        const wavelength = (vp * 3e8) / freq_hz;
        const gamma_l = this.zToGamma(zl, z0);
        const beta = 2 * Math.PI / wavelength;
        
        const expFactor = this.complexExp(-2 * beta * length_m);
        const gamma_in = this.complexMultiply(gamma_l, expFactor);
        
        const zin = this.gammaToZ(gamma_in, z0);
        const gammaMag = this.complexMagnitude(gamma_l);
        const vswr = (1 + gammaMag) / (1 - gammaMag);
        
        return {
            Zin: zin,
            Gamma_in: gamma_in,
            Gamma_l: gamma_l,
            VSWR: vswr,
            Wavelength: wavelength,
            Electrical_length: length_m / wavelength,
            Beta: beta
        };
    }

    calculateStub(zl, z0, freq_hz, vp = 1) {
        const yl = this.complexDivide({ real: 1, imag: 0 }, zl);
        const y0 = this.complexDivide({ real: 1, imag: 0 }, { real: z0, imag: 0 });
        const yl_norm = this.complexDivide(yl, y0);
        
        const g = yl_norm.real;
        const b = yl_norm.imag;
        
        const d1 = (Math.atan2(1 - b, g) - Math.atan2(b, g - 1)) / (4 * Math.PI);
        const d2 = (Math.atan2(1 - b, g) - Math.atan2(b, g - 1) + 2 * Math.PI) / (4 * Math.PI);
        const d_lam = Math.min(d1 % 0.5, d2 % 0.5);
        
        const y1_norm = {
            real: 1 + (b - g * Math.tan(4 * Math.PI * d_lam)),
            imag: 0
        };
        
        const b_stub = -y1_norm.imag;
        
        let l_stub_lam;
        if (b_stub >= 0) {
            l_stub_lam = Math.atan(b_stub) / (2 * Math.PI);
        } else {
            l_stub_lam = (Math.atan(b_stub) + Math.PI) / (2 * Math.PI);
        }
        
        const wavelength = (vp * 3e8) / freq_hz;
        const d_m = d_lam * wavelength;
        const l_stub_m = l_stub_lam * wavelength;
        
        return {
            d_lambda: d_lam,
            l_stub_lambda: l_stub_lam,
            d_m: d_m,
            l_stub_m: l_stub_m,
            b_stub: b_stub,
            y_match: y1_norm,
            yl_norm: yl_norm
        };
    }

    onDesignStub() {
        try {
            const z0 = parseFloat(document.getElementById('z0').value);
            const zl = this.parseComplex(document.getElementById('zl').value);
            const freq_hz = parseFloat(document.getElementById('freq').value) * 1e6;
            const vp = parseFloat(document.getElementById('vp').value);
            
            if (isNaN(z0) || isNaN(freq_hz) || isNaN(vp)) {
                throw new Error('Valores de entrada inválidos');
            }
            
            const results = this.calculateStub(zl, z0, freq_hz, vp);
            
            this.currentAnnotations = [];
            this.drawSmithChart();
            
            const gamma_zl = this.zToGamma(zl, z0);
            this.drawPoint(gamma_zl, 'Z_L', '#e74c3c', 'circle');
            
            const yl = this.complexDivide({ real: 1, imag: 0 }, zl);
            const gamma_yl = this.zToGamma(this.complexDivide({ real: 1, imag: 0 }, yl), z0);
            this.drawPoint(gamma_yl, 'Y_L', '#3498db', 'square');
            
            this.drawG1Circle();
            
            this.showResults('DISEÑO DE STUB', {
                'Z₀': `${z0.toFixed(1)} Ω`,
                'Z_L': `${zl.real.toFixed(1)} + ${zl.imag.toFixed(1)}j Ω`,
                'Y_L': `${yl.real.toFixed(4)} + ${yl.imag.toFixed(4)}j S`,
                'f': `${(freq_hz/1e6).toFixed(1)} MHz`,
                'Vp': `${vp.toFixed(2)}`
            }, {
                'Distancia': `${(results.d_m * 100).toFixed(2)} cm (${results.d_lambda.toFixed(3)} λ)`,
                'Long. stub': `${(results.l_stub_m * 100).toFixed(2)} cm (${results.l_stub_lambda.toFixed(3)} λ)`,
                'Susceptancia': `${results.b_stub.toFixed(3)} S`
            });
            
            this.history.push({
                Tipo: 'Stub',
                Z0: z0.toFixed(1),
                ZL: `${zl.real.toFixed(1)}+${zl.imag.toFixed(1)}j`,
                Distancia_λ: results.d_lambda.toFixed(3),
                Longitud_Stub_λ: results.l_stub_lambda.toFixed(3),
                Distancia_cm: (results.d_m * 100).toFixed(1),
                Longitud_cm: (results.l_stub_m * 100).toFixed(1)
            });
            
        } catch (error) {
            this.showError(`Error en diseño de stub: ${error.message}`);
        }
    }

    drawG1Circle() {
        const ctx = this.ctx;
        const center = this.config.center;
        const radius = this.config.radius;
        
        ctx.save();
        ctx.strokeStyle = this.config.g1CircleColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5;
        
        ctx.beginPath();
        ctx.arc(center - radius/2, center, radius/2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        
        ctx.save();
        ctx.fillStyle = this.config.g1CircleColor;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Círculo g=1', center - radius/2, center + radius/2 + 20);
        ctx.restore();
    }

    showResults(title, params, results) {
        let html = `<div class="results-title">${title}</div>`;
        html += `<div class="results-divider">══════════════════════════════════════════════</div>`;
        
        html += `<div class="results-section">`;
        html += `<div class="section-title">PARÁMETROS</div>`;
        html += `<div class="section-divider">──────────────────────────────</div>`;
        for (const [key, value] of Object.entries(params)) {
            html += `<div class="result-item"><span class="param-key">${key}:</span> <span class="param-value">${value}</span></div>`;
        }
        html += `</div>`;
        
        html += `<div class="results-section">`;
        html += `<div class="section-title">RESULTADOS</div>`;
        html += `<div class="section-divider">──────────────────────────────</div>`;
        for (const [key, value] of Object.entries(results)) {
            html += `<div class="result-item"><span class="param-key">${key}:</span> <span class="param-value">${value}</span></div>`;
        }
        html += `</div>`;
        
        this.resultsText.innerHTML = html;
    }

    showError(message) {
        this.resultsText.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <div class="error-title">ERROR</div>
                <div class="error-divider">══════════════════════════════════════════════</div>
                <div class="error-content">${message}</div>
                <div class="error-help">Verifique los valores de entrada e intente nuevamente.</div>
            </div>
        `;
    }

    onClear() {
        this.currentAnnotations = [];
        this.drawSmithChart();
        this.resultsText.innerHTML = `
            <div class="welcome-message">
                <h3>GRÁFICO LIMPIADO</h3>
                <p>Listo para nuevos cálculos.</p>
                <div class="instruction">
                    <p><strong>Instrucciones:</strong></p>
                    <p>1. Complete los campos de entrada</p>
                    <p>2. Seleccione una opción de cálculo</p>
                    <p>3. Revise los resultados aquí</p>
                </div>
            </div>
        `;
    }

    onShowHistory() {
        if (this.history.length === 0) {
            this.showError("No hay cálculos en el historial.");
            return;
        }
        
        const modal = document.getElementById('historyModal');
        const tableContainer = document.getElementById('historyTable');
        
        let html = `<table class="history-table">`;
        
        const headers = Object.keys(this.history[0]);
        html += `<thead><tr>`;
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += `</tr></thead>`;
        
        html += `<tbody>`;
        this.history.forEach((record, index) => {
            html += `<tr class="${record.Tipo === 'Z_in' ? 'zin-row' : 'stub-row'}">`;
            headers.forEach(header => {
                html += `<td>${record[header] || '-'}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody>`;
        html += `</table>`;
        
        tableContainer.innerHTML = html;
        modal.style.display = 'block';
    }

    onExport() {
        if (this.history.length === 0) {
            this.showError("No hay datos para exportar.");
            return;
        }
        
        const headers = Object.keys(this.history[0]);
        const csvRows = [
            headers.join(','),
            ...this.history.map(row => 
                headers.map(header => 
                    `"${row[header] || ''}"`
                ).join(',')
            )
        ];
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `smith_chart_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.resultsText.innerHTML = `
            <div class="success-message">
                <div class="success-icon">✓</div>
                <div class="success-title">DATOS EXPORTADOS</div>
                <div class="success-divider">══════════════════════════════════════════════</div>
                <div class="success-content">Los datos han sido exportados exitosamente.</div>
                <div class="success-help">El archivo CSV se descargará automáticamente.</div>
            </div>
        `;
    }

    exportHistory() {
        this.onExport();
        document.getElementById('historyModal').style.display = 'none';
    }

    clearHistory() {
        this.history = [];
        document.getElementById('historyTable').innerHTML = '<p class="no-history">No hay cálculos en el historial.</p>';
    }

    onShowHelp() {
        document.getElementById('helpModal').style.display = 'block';
    }
}

// Inicializar la aplicación cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
    const app = new SmithChartProfessional();
});
# Imagens do Bússola Executiva

Esta pasta contém as imagens utilizadas no aplicativo Bússola Executiva.

## Estrutura de Pastas

- **logos**: Logotipos da Bússola Executiva e outras marcas
- **presenters**: Imagens da apresentadora
- **icons**: Ícones utilizados na interface
- **backgrounds**: Imagens de fundo

## Como Usar

1. **Para a apresentadora**:
   - Salve a imagem da apresentadora como `apresentadora.jpg` na pasta `presenters`
   - No código, use: `/assets/images/presenters/apresentadora.jpg`

2. **Para o logo**:
   - Salve o logo como `logo.png` ou `logo.svg` na pasta `logos`
   - No código, use: `/assets/images/logos/logo.png`

3. **Para ícones**:
   - Salve os ícones na pasta `icons`
   - No código, use: `/assets/images/icons/nome-do-icone.svg`

4. **Para imagens de fundo**:
   - Salve as imagens de fundo na pasta `backgrounds`
   - No código, use: `/assets/images/backgrounds/nome-da-imagem.jpg`

## Exemplo de Uso no Código

```jsx
// Para usar o logo
<img src="/assets/images/logos/logo.png" alt="Bússola Executiva" className="h-12" />

// Para usar a imagem da apresentadora
<img 
  src="/assets/images/presenters/apresentadora.jpg" 
  alt="Apresentadora" 
  style={{ 
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center'
  }}
/>
```

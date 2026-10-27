const original=new Set(['1.7','1.8','1.9','1.10','1.11','1.12','1.13','1.14','1.15','1.16','1.17','1.18','1.19','1.20','26.2','26.3']);
export function protocolArt(name:string){
    const match=name.match(/\d+\.\d+(?:\.\d+)?/);
    if(!match)return '';
    const [major,minor,patch=0]=match[0].split('.').map(Number);
    const family=`${major}.${minor}`;
    if(original.has(family))return `opai/version/${family}.png`;
    if(major===1&&minor===21){
        const release=patch>=11?'1.21.11':patch>=9?'1.21.9':patch>=6?'1.21.6':patch>=5?'1.21.5':patch>=4?'1.21.4':patch>=2?'1.21.2':'1.21';
        return `opai/version-extra/${release}.png`;
    }
    if(major===26&&minor===1)return 'opai/version-extra/26.1.png';
    return '';
}

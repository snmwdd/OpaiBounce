import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
// Deterministic offline Gaussian blur, no graphics device or runtime CSS filter.
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let input=root.appendingPathComponent("reports/via-sources")
let output=root.appendingPathComponent("public/opai/version-extra")
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
let width=352,height=176,sigma:Float=5,radius=15
var kernel=(-radius...radius).map{exp(-Float($0*$0)/(2*sigma*sigma))}
let total=kernel.reduce(0,+);kernel=kernel.map{$0/total}
let space=CGColorSpaceCreateDeviceRGB()
let flags=CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue
for file in try FileManager.default.contentsOfDirectory(at:input,includingPropertiesForKeys:nil) where file.pathExtension=="jpg" {
    guard let source=CGImageSourceCreateWithURL(file as CFURL,nil),let image=CGImageSourceCreateImageAtIndex(source,0,nil) else {fatalError("Invalid source: \(file)")}
    var pixels=[UInt8](repeating:0,count:width*height*4)
    pixels.withUnsafeMutableBytes{bytes in
        let context=CGContext(data:bytes.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:flags)!
        let factor=max(CGFloat(width)/CGFloat(image.width),CGFloat(height)/CGFloat(image.height))
        let w=CGFloat(image.width)*factor,h=CGFloat(image.height)*factor
        context.interpolationQuality = .high
        context.draw(image,in:CGRect(x:(CGFloat(width)-w)/2,y:(CGFloat(height)-h)/2,width:w,height:h))
    }
    var horizontal=[Float](repeating:0,count:pixels.count),result=[UInt8](repeating:0,count:pixels.count)
    for y in 0..<height {for x in 0..<width {for c in 0..<4 {
        var sum:Float=0
        for d in -radius...radius {sum+=Float(pixels[(y*width+min(width-1,max(0,x+d)))*4+c])*kernel[d+radius]}
        horizontal[(y*width+x)*4+c]=sum
    }}}
    for y in 0..<height {for x in 0..<width {for c in 0..<4 {
        var sum:Float=0
        for d in -radius...radius {sum+=horizontal[(min(height-1,max(0,y+d))*width+x)*4+c]*kernel[d+radius]}
        result[(y*width+x)*4+c]=UInt8(max(0,min(255,sum.rounded())))
    }}}
    let data=Data(result) as CFData
    let provider=CGDataProvider(data:data)!
    let raster=CGImage(width:width,height:height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:width*4,space:space,bitmapInfo:CGBitmapInfo(rawValue:flags),provider:provider,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
    let destination=output.appendingPathComponent(file.deletingPathExtension().lastPathComponent+".png")
    let writer=CGImageDestinationCreateWithURL(destination as CFURL,UTType.png.identifier as CFString,1,nil)!
    CGImageDestinationAddImage(writer,raster,nil)
    guard CGImageDestinationFinalize(writer) else {fatalError("Cannot encode")}
    print(file.deletingPathExtension().lastPathComponent)
}

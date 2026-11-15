import java.nio.file.*;
import java.util.*;
import org.graalvm.polyglot.*;
import net.minecraft.core.*;
import net.minecraft.world.item.DyeColor;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.*;
import net.minecraft.world.level.material.FluidState;
import net.ccbluex.liquidbounce.utils.block.bed.*;

/** Integration regression against actual Minecraft block states and the production JS function. */
public class BedProtectionProbe {
    public static final class World implements BlockGetter {
        final Map<BlockPos,BlockState> blocks = new HashMap<>();
        boolean loaded = true;
        public boolean hasChunkAt(BlockPos pos) { return loaded; }
        public BlockEntity getBlockEntity(BlockPos pos) { return null; }
        public BlockState getBlockState(BlockPos pos) { return blocks.getOrDefault(pos, Blocks.AIR.defaultBlockState()); }
        public FluidState getFluidState(BlockPos pos) { return getBlockState(pos).getFluidState(); }
        public int getHeight() { return 384; }
        public int getMinY() { return -64; }
    }
    static String function(String source, String name, String next) {
        int start = source.indexOf("    function " + name + "(");
        if (start < 0) return "";
        int end = source.indexOf("    function " + next + "(", start);
        if (end < 0) throw new IllegalArgumentException("Missing function boundary " + next);
        return source.substring(start,end);
    }
    public static void main(String[] args) throws Exception {
        net.minecraft.SharedConstants.tryDetectVersion();
        net.minecraft.server.Bootstrap.bootStrap();
        String source = Files.readString(Path.of(args[0]));
        World world = new World();
        BlockPos anchor = new BlockPos(4,64,4);
        try (Context context = Context.newBuilder("js").allowAllAccess(true).option("engine.WarnInterpreterOnly","false").build()) {
            context.getBindings("js").putMember("world",world);
            context.eval("js", "const type=Java.type, client={level:world};\n"
                + function(source,"loadBedTypes","restoreBeds")
                + function(source,"bedPartner","bedProtection")
                + function(source,"bedProtection","drawBedPlates")
                + "\nconst types=loadBedTypes();");
            System.out.println("Native JS inherited BedBlock.PART: " + context.eval("js", "String(type('net.minecraft.world.level.block.BedBlock').PART)"));
            int cases = 0;
            for (DyeColor color : DyeColor.values()) {
                BedBlock bed = (BedBlock)net.minecraft.core.registries.BuiltInRegistries.BLOCK.getValue(net.minecraft.resources.Identifier.withDefaultNamespace(color.getName()+"_bed"));
                for (Direction facing : List.of(Direction.NORTH,Direction.SOUTH,Direction.EAST,Direction.WEST)) {
                    for (BedPart part : BedPart.values()) {
                        BlockPos partner = anchor.relative(part==BedPart.HEAD ? facing.getOpposite() : facing);
                        for (int coverage=0;coverage<3;coverage++) {
                            world.blocks.clear();world.loaded=true;
                            world.blocks.put(anchor,bed.defaultBlockState().setValue(BlockStateProperties.HORIZONTAL_FACING,facing).setValue(BlockStateProperties.BED_PART,part));
                            world.blocks.put(partner,bed.defaultBlockState().setValue(BlockStateProperties.HORIZONTAL_FACING,facing).setValue(BlockStateProperties.BED_PART,part==BedPart.HEAD?BedPart.FOOT:BedPart.HEAD));
                            if (coverage==1) world.blocks.put(anchor.above(),Blocks.GLASS.defaultBlockState());
                            if (coverage==2) for (BlockPos center : List.of(anchor,partner)) for (Direction direction : Direction.values()) {
                                BlockPos neighbor=center.relative(direction);
                                if (direction!=Direction.DOWN && !neighbor.equals(anchor) && !neighbor.equals(partner)) world.blocks.put(neighbor,Blocks.GLASS.defaultBlockState());
                            }
                            List<SurroundingBlock> surrounding=coverage==0?List.of():List.of(new SurroundingBlock(Blocks.GLASS,1,1));
                            BedState tracked=new BedState(bed,anchor,net.minecraft.world.phys.Vec3.atCenterOf(anchor),surrounding,surrounding);
                            context.getBindings("js").putMember("tracked",tracked);
                            String actual=context.eval("js","bedProtection(tracked,types)").asString();
                            String expected=coverage==0?"Not Protected":coverage==1?"Not Full Protected":"Fully Protected";
                            if (!expected.equals(actual)) throw new AssertionError(color+" "+facing+" "+part+": "+actual+" != "+expected);
                            cases++;
                        }
                    }
                }
            }
            world.loaded=false;
            if (!context.eval("js","bedProtection(tracked,types)").asString().equals("Unknown Protection")) throw new AssertionError("Unloaded neighbor");
            world.loaded=true;world.blocks.clear();
            if (!context.eval("js","bedProtection(tracked,types)").asString().equals("Unknown Protection")) throw new AssertionError("Bed replacement race");
            System.out.println("PASS real Minecraft states / GraalJS: "+cases+" bed protection cases, 16 colors × 4 facings × 2 halves × 3 coverage states; unloaded/replaced beds handled.");
        } catch (PolyglotException error) {
            if (error.isHostException()) error.asHostException().printStackTrace();
            throw error;
        }
    }
}

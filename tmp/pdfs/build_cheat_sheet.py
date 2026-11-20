from pathlib import Path
import re
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / 'os_exam_front_back_cheat_sheet.pdf'
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Italic', r'C:\Windows\Fonts\ariali.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial-Italic', boldItalic='Arial-Bold')

NAVY = colors.HexColor('#162B3C')
TEAL = colors.HexColor('#096B70')
INK = colors.HexColor('#17212A')
RULE = colors.HexColor('#C8D0D5')
PALE = colors.HexColor('#F0F4F5')

# Body content is intentionally divided into six fixed columns: one printed sheet.
COLS = [
[
('title', '01  Memory & addressing', 'TOPIC 5 / TOPIC 6A'),
('h', 'Allocation & protection'),
('p', '<b>Virtual/logical address (VA)</b> comes from CPU; <b>physical address (PA)</b> locates RAM. MMU translates at runtime. Processes have separate virtual spaces; equal VAs need not map to equal frames.'),
('p', '<b>Base + limit:</b> accept logical address a only if 0 ≤ a &lt; limit; then PA = base + a. Otherwise trap. Contiguous allocation gives each process one physical region.'),
('p', '<b>Holes:</b> first fit = first large enough; best fit = smallest large enough; worst fit = largest. Coalesce adjacent free holes on release.'),
('p', '<b>External fragmentation:</b> free space exists but is split into holes. <b>Internal:</b> unused bytes inside allocated units. Compaction combines holes and requires relocation. Paging avoids external fragmentation of frame allocation; internal waste remains.'),
('h', 'Paging: split, translate, preserve offset'),
('p', '<b>Pages are virtual; frames are physical.</b> Same size P. For byte address a and P = 2<super>b</super>:'),
('box', 'VPN = floor(a / P); d = a mod P<br/>f = page_table[VPN]; <b>PA = f × P + d</b><br/>v-bit VA = (v − b) VPN bits | b offset bits'),
('p', '<b>4 KiB = 4096 B = 2<super>12</super>:</b> offset = low 12 bits = last 3 hex digits. VA 0x12345 → VPN 0x12, offset 0x345. If frame = 0x2A, PA = <b>0x2A345</b>. VA 0x4000 has VPN 4, offset 0.'),
('p', '<b>Frames needed</b> = ceil(S/P). <b>Waste</b> = ceil(S/P)P − S; at most P − 1 B, average ≈ P/2. S = 72,766 B, P = 2048 B → 36 frames, <b>962 B wasted</b>. Smaller pages: less waste, larger page tables.'),
('h', 'Page tables & TLB'),
('p', '<b>PTE:</b> frame number plus status/protection bits. Distinguish <b>legal/mapped</b> from <b>present/resident</b>; slides use “valid” for both contexts. Read/write/execute permissions are separate checks. Shared read-only code may map to the same frames.'),
('p', '<b>PTBR</b> points to page-table root. Flat table has 2<super>v−b</super> entries; bytes = entries × PTE size. 32-bit VA, 4 KiB pages, 4-B PTE → 2<super>20</super> entries = <b>4 MiB/process</b>.'),
('p', '<b>TLB</b> caches translations associatively. Hit → frame; miss → table walk + refill. <b>TLB miss ≠ page fault.</b> ASIDs distinguish processes; otherwise translations may need flushing on switches.'),
('box', '<b>TLB EAT (no page faults)</b><br/>h(t + m) + (1 − h)(t + 2m)<br/>h = hit rate; t = TLB time; m = RAM time.<br/>k-level miss: t + (k + 1)m, absent caches.'),
],
[
('title', '02  Virtual memory', 'TOPIC 6A / TOPIC 6B'),
('h', 'Page-table organizations'),
('p', '<b>Hierarchical:</b> allocate lower-level tables only for used virtual regions. Saves table memory for sparse address spaces; adds walk steps. With 4 KiB table pages / 4-B PTEs: 1024 entries per table.'),
('box', '<b>32-bit, 4 KiB, two-level split</b><br/>10 outer bits | 10 inner bits | 12 offset bits<br/>Each index selects a PTE; offset stays fixed.'),
('p', '<b>Hashed:</b> hash VPN, follow collision chain, match VPN, obtain frame. <b>Inverted:</b> one entry per physical frame, storing process ID + VPN. Less table memory; lookup and shared mappings are harder. Hashing/TLB help.'),
('p', '<b>Segmentation:</b> logical address selects a segment and offset. 8086 forms a 20-bit address from (segment × 16) + offset. IA-32: segment translation → linear address → paging → PA. Typical x86-64 uses four paging levels; optional fifth level extends VA range.'),
('h', 'Demand paging & fork'),
('p', '<b>Virtual memory</b> separates address space from RAM: only needed pages must be resident. A process can exceed RAM size. Reserving virtual memory alone need not allocate resident frames; touching pages triggers demand allocation.'),
('box', '<b>Complete page-fault answer</b><br/>1. Trap to kernel; save execution state.<br/>2. Check address/permissions; reject illegal access.<br/>3. Locate backing page; get frame or choose victim. Write dirty victim; invalidate its PTE/TLB mapping before frame reuse.<br/>4. Read page or zero-fill. Disk I/O blocks process; schedule another.<br/>5. Completion: update PTE/TLB; blocked → ready.<br/>6. When scheduled: restore state, return to user mode, restart faulting instruction.'),
('p', '<b>Copy-on-write (COW):</b> after fork(), separate virtual spaces share read-only frames. First write → protection fault → allocate/copy frame → update writer’s PTE → invalidate stale TLB entry → retry instruction. Only modified pages are copied. Protection faults need not mean termination.'),
('p', '<b>fork() returns</b> child PID to parent, 0 to child, −1 on failure. Child inherits file descriptors. <b>exec()</b> replaces the program. <b>vfork()</b> suspends parent while child prepares to exec/exit.'),
('h', 'Fault cost: units matter'),
('box', '<b>EAT = (1 − p)M + pF</b><br/>p = fault probability; M = normal access;<br/>F = total fault-service time, including restart.<br/>1 ms = 10<super>6</super> ns; 1 µs = 10<super>3</super> ns.'),
('p', 'M = 200 ns, F = 8 ms →<br/><b>EAT = 200 + 7,999,800p ns.</b><br/>p = 0.001 → ≈ 8.2 µs, about 41× slower. For &lt;10% slowdown:<br/>p &lt; 20/7,999,800 ≈ <b>2.5 × 10<super>−6</super></b> (less than 1 fault / 400,000 accesses).'),
('p', '<b>Swapping:</b> traditional = whole process; modern usage often = pages. Transfer cost ≈ bytes / bandwidth per direction, plus device overhead. Dirty-victim fault may need both a write-out and a read-in.'),
('p', '<b>Frame pools:</b> kernel/user/DMA constraints may require separate pools. Pool-management metadata consumes memory too; keep free/zeroed frames ready for the fault path.'),
],
[
('title', '03  Page replacement', 'TOPIC 7A / TOPIC 7B'),
('h', 'Trace rules: simulate every reference'),
('p', 'Start with empty frames unless stated. <b>Hit:</b> page already present. <b>Fault:</b> absent; fill a free frame before evicting. Track frames, bookkeeping, victim and cumulative faults separately.'),
('table', ['Policy', 'Victim / update rule'], [
 ['FIFO', 'Oldest loaded. Queue advances on faults; hits do not reorder.'],
 ['OPT', 'Farthest next use; never used again first. Requires future knowledge.'],
 ['LRU', 'Oldest last use. Every hit updates recency. Exact timestamps/stack are costly.'],
 ['Clock / second chance', 'Access sets R=1. At hand: R=1 → clear, advance; R=0 → evict. Resume after victim.'],
 ['Enhanced second chance', 'Prefer (R,dirty): (0,0), (0,1), (1,0), (1,1). Clean, unreferenced first.'],
 ['LFU / MFU', 'Evict smallest / largest reference count; stale counts can mislead.'],
 ], [0.28, 0.72]),
('p', '<b>Clock check:</b> frames [A,B,C], R=[1,0,1], hand at A. Miss D → clear A; evict B; put D with R=1; hand moves to C. Dirty bit records writes; reference bit records use.'),
('p', '<b>3-frame benchmark:</b><br/>7 0 1 2 0 3 0 4 2 3 0 3 0 3 2 1 2 0 1 7 0 1<br/><b>FIFO 15 | LRU 12 | OPT 9 faults</b>.'),
('p', '<b>Belady’s anomaly:</b> more frames can increase FIFO faults. For 1 2 3 4 1 2 5 1 2 3 4 5: 3 frames → 9; 4 → 10. LRU/OPT have the stack property and do not have this anomaly.'),
('h', 'Allocation, locality & thrashing'),
('p', '<b>Global:</b> victim may belong to another process; flexible throughput, variable per-process performance. <b>Local:</b> evict only own frames; better isolation, possible underuse. Reclaim before the free-frame list reaches zero.'),
('p', '<b>NUMA:</b> memory access cost depends on CPU/memory location. Allocate frames near the running CPU; affinity and page migration preserve locality.'),
('p', '<b>Thrashing:</b> too few resident pages → repeated eviction/reload → high fault rate, low useful CPU work. Adding processes can worsen it. Local replacement limits interference but does not create extra RAM.'),
('box', '<b>Working-set model</b><br/>WSS<sub>i</sub>(Δ) = number of DISTINCT pages used in last Δ references.<br/>D = Σ WSS<sub>i</sub>; m = available frames.<br/><b>D &gt; m → suspend/swap out processes.</b>'),
('p', 'Δ too small misses part of a locality; too large combines localities; infinite Δ covers the whole program. Approximate with periodic reference-bit samples. <b>Example:</b> last five refs 1,2,1,3,2 → working set {1,2,3}, size 3.'),
('p', '<b>Page-fault frequency:</b> above upper bound → give frames; below lower bound → take frames. If demand exceeds RAM, reduce multiprogramming.'),
],
[
('title', '04  Disks, storage & RAID', 'TOPIC 8 / TOPIC 9 + ADDENDUM'),
('h', 'HDD cost & storage interfaces'),
('p', '<b>Track:</b> circular path; <b>sector:</b> subdivision; <b>cylinder:</b> same-radius tracks across platters. Seek positions head; rotation brings sector to head.'),
('box', 'Average rotation = <b>30,000/RPM ms</b><br/>I/O time = seek + rotation + bytes/rate<br/>+ controller overhead (add queueing if given).<br/>Access latency = seek + average rotation.'),
('p', '7200 RPM → 4.17 ms average rotation. Seek 5 ms + overhead 0.1 ms + 4 KiB at 1 Gb/s (0.0328 ms) → <b>9.30 ms</b>. 8 bits/B; small random I/O is positioning dominated.'),
('p', '<b>Host-attached:</b> local I/O. <b>NAS:</b> remote files, NFS/CIFS. <b>SAN:</b> remote blocks/LUNs through storage fabric; iSCSI carries SCSI over IP. <b>Cloud:</b> WAN/API access.'),
('h', 'RAID: N equal disks of size S'),
('table', ['Level', 'Min', 'Usable', 'Survives'], [
 ['0 stripe', '2', 'NS', '0 failures'],
 ['1 mirror*', '2', 'NS/2', '1 per pair'],
 ['10 (1+0)', '4', 'NS/2', '1 per pair'],
 ['0+1', '4', 'NS/2', 'Any 1'],
 ['5 parity', '3', '(N−1)S', 'Any 1'],
 ['6 dual code', '4', '(N−2)S', 'Any 2'],
 ], [0.24,0.12,0.25,0.39]),
('p', '<b>*Mirrored pairs</b> assume even N; an N-way mirror has capacity S. Striping increases parallel bandwidth; mirrors duplicate writes and can serve reads from either copy.'),
('p', '<b>RAID 10:</b> stripe over mirror pairs; loses data if both disks of a pair fail. Rebuild copies the surviving mirror. <b>0+1:</b> mirror striped sets; first failure disables a set; surviving set must stay intact. More failures may survive if confined to disabled set.'),
('h', 'Parity, reconstruction & failures'),
('p', '<b>Even parity:</b> append bit so total ones is even. Detects odd numbers of flips; even flips can escape. Does not locate the bad bit.'),
('box', '<b>P = D1 XOR D2 XOR D3</b><br/>Lost D2 = P XOR D1 XOR D3<br/>1011 XOR 0110 XOR 1100 = 0001<br/>0001 XOR 1011 XOR 1100 = <b>0110</b>'),
('p', '<b>RAID 5:</b> rotating parity avoids one dedicated parity bottleneck. Small write ≈ <b>4 I/Os</b>: read old data/parity, write new data/parity. <b>RAID 6:</b> P = XOR, Q = independent finite-field code; ≈ <b>6 I/Os</b>. Q is not duplicate XOR.'),
('p', 'Disk <b>ECC</b> detects/corrects errors; an uncorrectable read identifies a block for RAID reconstruction. Parity alone does not locate silent corruption. Rebuild reads survivors; RAID 5 cannot tolerate a second disk loss during rebuild. Hot spare shortens exposure.'),
('p', '<b>Independent 2-disk mirror:</b> MTTDL ≈ MTTF²/(2 × MTTR). Faster repair reduces exposure. NVRAM buffers writes; snapshot = point-in-time view; replication = another array/site.'),
('p', '<b>Memcached:</b> RAM cache; miss → DB → fill; DB update → invalidate. Slab classes: same-sized chunks, class-local LRU; poor sizing wastes capacity.'),
],
[
('title', '05  Files & directories', 'TOPIC 10 / ALL SLIDES'),
('h', 'Identity, names & open state'),
('p', '<b>File:</b> byte array. <b>Directory:</b> names → inode numbers. Inode stores type, size, owner/permissions, timestamps, links and block locations; <b>not name or offset</b>. Absolute path starts at /; relative at current directory. “.” = self; “..” = parent.'),
('box', '<b>Per-process FD table</b><br/>→ system open-file entry (offset, mode, refs)<br/>→ inode (metadata) → data blocks<br/>FD 0/1/2 = stdin/stdout/stderr.'),
('p', '<b>Separate open() calls:</b> independent entries/offsets, even for one inode. <b>fork()/dup():</b> share entry and offset. Closing one reference may leave the entry in use.'),
('p', '<b>Trace:</b> open same file twice; read(a,100), read(b,100) both read bytes 0–99. With shared entry, second read begins at 100 (assuming first finishes first).'),
('h', 'Core interface & durability'),
('p', '<b>open(path, flags, 0600):</b> O_CREAT = create if absent; O_WRONLY = write-only; O_TRUNC = truncate. read/write return actual bytes and advance offset; read = 0 means EOF. Loop for short transfers; close releases FD.'),
('p', '<b>lseek(fd,k,SEEK_SET/CUR/END):</b> offset from start/current/end; in-memory, no physical disk seek. <b>stat/fstat:</b> metadata. mkdir creates; opendir/readdir/closedir enumerate; rmdir requires empty directory.'),
('p', '<b>write() completion ≠ persistence.</b> Data may remain in dirty RAM buffers. <b>fsync(fd)</b> requests durable file updates. File/name creation may also need fsync on parent directory.'),
('box', '<b>Atomic replacement</b><br/>write temp → fsync(temp) → close<br/>→ rename(temp,target) → fsync(parent dir)<br/>Rename changes the name atomically;<br/><b>atomicity ≠ crash durability.</b>'),
('h', 'Links, deletion & permissions'),
('table', ['Hard link', 'Symbolic link'], [
 ['Name → same inode; no original.', 'Own inode stores a path.'],
 ['Same filesystem; no copy.', 'Cross-filesystem; may dangle.'],
 ['ln file alias', 'ln -s file alias'],
 ], [0.5,0.5]),
('p', '<b>unlink:</b> remove name, decrement link count. Reclaim storage when link count = 0 <b>and</b> no open references remain. Removing a target name does not remove its other hard links.'),
('p', '<b>Owner/group/other:</b> r=4, w=2, x=1. 600 = rw-------; 644 = rw-r--r--; 755 = rwxr-xr-x. <b>File:</b> r contents, w modify, x execute. <b>Directory:</b> r list names; w change entries (normally also needs x); x traverse/search. Traversal needs x on path directories.'),
('p', '<b>ACLs</b> give finer user/group access. <b>TOCTTOU:</b> pathname may change between check and use; checking stat then opening can race.'),
('p', '<b>mkfs</b> creates filesystem; <b>mount</b> attaches its root at a directory in the unified tree. <b>mmap(MAP_SHARED)</b> exposes file-backed bytes through loads/stores; synchronization still matters.'),
],
[
('title', '06  File-system internals', 'TOPIC 11 / PDF SLIDES 1–26'),
('h', 'vsfs on-disk structures'),
('p', 'vsfs: 64 × 4 KiB blocks = <b>256 KiB</b>. Know on-disk structures and which blocks each syscall reads, modifies and writes.'),
('table', ['Blocks', 'Contents / purpose'], [
 ['0', 'Superblock: filesystem parameters'],
 ['1', 'Inode bitmap: used/free inodes'],
 ['2', 'Data bitmap: used/free data blocks'],
 ['3–7', 'Inode table: 5 blocks'],
 ['8–63', 'Data region: 56 blocks'],
 ], [0.22,0.78]),
('p', 'Bitmap: <b>0 free, 1 allocated.</b> Five 4 KiB inode-table blocks / 256-B inode → <b>80 inodes</b>; directories also need inodes. Data space may run out first.'),
('box', '<b>Inode i (zero-based)</b><br/>block = T + floor(i × I / B)<br/>offset = (i × I) mod B<br/>T = table start; B = block size; I = inode size.<br/>i=32, T=3, B=4096, I=256 → <b>block 5</b>, offset 0; 512-B sectors → sector 40.'),
('h', 'Block pointers & extents'),
('p', 'Let B = block bytes, A = pointer bytes, K=B/A pointers per indirect block, d = direct pointers. <b>Data capacity</b> with direct + single + double = <b>B(d + K + K²)</b>. Pointer blocks themselves consume extra disk space.'),
('table', ['4 KiB / 4-B ptr', 'Additional data'], [
 ['12 direct pointers', '48 KiB'],
 ['Single indirect', '1024 blocks = 4 MiB'],
 ['Double indirect', '1024² blocks = 4 GiB'],
 ], [0.55,0.45]),
('p', '<b>Small files:</b> direct pointers avoid indirect-block reads. <b>Extent:</b> start block + length describes a contiguous run; fewer pointers, relies on contiguous allocation. Directory data blocks store name → inode pairs.'),
('h', 'Access paths & I/O accounting'),
('p', '<b>Cold open /foo/bar:</b> root inode → root data → foo inode → foo data → bar inode = <b>5 reads</b> in the simple model. Reading file data follows inode pointers; <b>does not read allocation bitmap</b>. Cached metadata reduces reads.'),
('p', '<b>Create:</b> find parent → allocate inode (read/update inode bitmap) → initialize inode → add name in parent data → update parent inode. Parent growth may allocate another data block.'),
('box', '<b>One allocating write = 5 logical I/Os</b><br/>read data bitmap → write data bitmap<br/>→ read inode → write inode → write data<br/><b>Create + write 3 new blocks:</b><br/>10 + 3 × 5 = <b>25 logical I/Os</b>.'),
('p', 'Counts use the chapter’s uncached model. <b>Real syscall costs vary.</b> State cache, allocation, indirect-block and read/write assumptions.'),
('h', 'Caching & buffering'),
('p', '<b>Unified page cache</b> uses RAM dynamically for file data/metadata. Warm opens/reads reuse cached blocks. Buffered writes batch updates, schedule I/O and avoid transient writes; a crash can lose unflushed changes. <b>fsync</b> adds work to satisfy a durability requirement.'),
('p', '<b>Examples:</b> NTFS/exFAT/FAT32 (≈ 4 GiB file limit); APFS; ext4/XFS/Btrfs/ZFS. tmpfs uses volatile memory.'),
],
]

# Balance related material before measuring; avoid shrinking one overfull column.
for prefix in ['<b>Segmentation:', '<b>Frame pools:']:
    item = next(b for b in COLS[1] if len(b)>1 and b[1].startswith(prefix))
    COLS[1].remove(item)
    COLS[0].append(item)
replacement_table = next(b for b in COLS[2] if b[0]=='table')
at = COLS[2].index(replacement_table)
COLS[2][at:at+1] = [('p', '<b>'+name+':</b> '+rule) for name,rule in replacement_table[2]]
memcache = next(b for b in COLS[3] if b[0]=='p' and b[1].startswith('<b>Memcached:'))
COLS[3].remove(memcache)
COLS[2] += [('h','RAM cache example (Topic 8)'),memcache]
vsfs_table = next(b for b in COLS[5] if b[0]=='table')
at = COLS[5].index(vsfs_table)
COLS[5][at] = ('box','<b>Block 0:</b> superblock (parameters)<br/><b>1:</b> inode bitmap; <b>2:</b> data bitmap<br/><b>3–7:</b> inode table (5 blocks)<br/><b>8–63:</b> data region (56 blocks)')

def normalize_dashes(value):
    if isinstance(value,str):
        return value.replace('\u2013','-').replace('\u2014','-').replace('\u2011','-')
    if isinstance(value,list): return [normalize_dashes(v) for v in value]
    if isinstance(value,tuple): return tuple(normalize_dashes(v) for v in value)
    return value
COLS = normalize_dashes(COLS)

W, H = 612, 792
LEFT, GUTTER = 24, 10
CW = (W - 2*LEFT - 2*GUTTER)/3
TOP, BOTTOM = 720, 32

def flowables(blocks, fs):
    body = ParagraphStyle('body',fontName='Arial',fontSize=fs,leading=fs*1.11,textColor=INK,spaceAfter=2.7)
    heading = ParagraphStyle('heading',parent=body,fontName='Arial-Bold',fontSize=fs+0.8,leading=fs+2.1,textColor=TEAL,spaceBefore=3.0,spaceAfter=2.4)
    title = ParagraphStyle('title',parent=body,fontName='Arial-Bold',fontSize=11.0,leading=12.5,textColor=NAVY,spaceAfter=2.7)
    kicker = ParagraphStyle('kicker',parent=body,fontName='Arial-Bold',fontSize=6.6,leading=8.3,textColor=TEAL,spaceAfter=5.0)
    boxstyle = ParagraphStyle('box',parent=body,fontSize=fs,leading=fs*1.13,spaceAfter=0)
    cell = ParagraphStyle('cell',parent=body,fontSize=fs-0.25,leading=fs*1.12,spaceAfter=0)
    cellhead = ParagraphStyle('cellhead',parent=cell,fontName='Arial-Bold',textColor=NAVY)
    out=[]
    for item in blocks:
        kind=item[0]
        if kind=='title':
            out += [Paragraph(item[1].replace('–','-'),title),Paragraph(item[2].replace('–','-'),kicker)]
        elif kind=='h': out.append(Paragraph(item[1],heading))
        elif kind=='p': out.append(Paragraph(item[1],body))
        elif kind=='box':
            t=Table([[Paragraph(item[1],boxstyle)]],colWidths=[CW])
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),0.35,RULE),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
            out += [t, Spacer(1,4)]
        elif kind=='table':
            headers,rows,widths=item[1:]
            data=[[Paragraph(x,cellhead) for x in headers]]+[[Paragraph(x,cell) for x in row] for row in rows]
            t=Table(data,colWidths=[CW*w for w in widths],hAlign='LEFT')
            t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,0),0.6,RULE),('LINEBELOW',(0,1),(-1,-1),0.25,RULE),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
            out += [t,Spacer(1,4)]
    return out

def total_height(blocks,fs):
    return sum(f.wrap(CW,10000)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in flowables(blocks,fs))

# Use one common body size; keep it readable and fail if the sheet cannot fit.
font_size=8.4
while max(total_height(b,font_size) for b in COLS) > TOP-BOTTOM and font_size>7.8:
    font_size=round(font_size-0.05,2)
heights=[round(total_height(b,font_size),1) for b in COLS]
assert max(heights)<=TOP-BOTTOM, (font_size,heights)
print('Body size:',font_size,'Column heights:',heights,'Available:',TOP-BOTTOM)

c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
c.setTitle('Operating Systems Exam - One Sheet, Front and Back')
c.setAuthor('Exam reference prepared from supplied course slides')
c.setSubject('Topics 5-10 and Topic 9 parity addendum; Topic 11 through PDF page 26')
for page in range(2):
    c.setFillColor(NAVY)
    c.setFont('Arial-Bold',17)
    c.drawString(LEFT,758,'CSCE 410  /  Exam reference')
    c.setFont('Arial-Bold',8)
    c.drawRightString(W-LEFT,760,('FRONT  /  1 OF 2','BACK  /  2 OF 2')[page])
    c.setFont('Arial',7.3)
    c.setFillColor(INK)
    c.drawString(LEFT,743,('Memory • paging • replacement • caching   |   Topics 5-8','Disks • storage • files   |   Topics 8-10 + Topic 11 PDF slides 1-26')[page])
    c.setStrokeColor(NAVY); c.setLineWidth(1.1);c.line(LEFT,734,W-LEFT,734)
    for k in range(3):
        x=LEFT+k*(CW+GUTTER)
        if k:
            c.setStrokeColor(RULE);c.setLineWidth(0.4);c.line(x-GUTTER/2,BOTTOM,x-GUTTER/2,TOP)
        y=TOP
        for f in flowables(COLS[page*3+k],font_size):
            y-=f.getSpaceBefore()
            _,fh=f.wrap(CW,10000)
            f.drawOn(c,x,y-fh)
            y-=fh+f.getSpaceAfter()
        assert y>=BOTTOM-0.1, (page,k,y)
    c.setStrokeColor(RULE);c.setLineWidth(0.4);c.line(LEFT,24,W-LEFT,24)
    c.setFont('Arial',6.5);c.setFillColor(INK)
    c.drawString(LEFT,14,'Scope: supplied Topics 5-10 + RAID addendum; Topic 11 ends at PDF 26 (recap). KiB=1024 B; MiB=1024 KiB.')
    c.drawRightString(W-LEFT,14,'US Letter • actual size • duplex / long edge')
    c.showPage()
c.save()
print(PDF)
print('Approximate words:',sum(len(re.sub('<[^>]+>',' ',str(b)).split()) for col in COLS for b in col))

// Demo blog posts for testing
export interface BlogPost {
  id: string;
  title: string;
  title_vi: string;
  slug: string;
  excerpt: string;
  excerpt_vi: string;
  content: string;
  content_vi: string;
  author: string;
  date: string;
  image: string;
  category: string;
  tags: string[];
}

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "Planning Your Trip: Do It Yourself or Let AI Handle It?",
    title_vi: "Lập kế hoạch du lịch: Tự làm hay để AI xử lý?",
    slug: "planning-trip-ai-vs-diy",
    excerpt: "Discover the pros and cons of traditional trip planning versus AI-powered itineraries, and learn which approach works best for your travel style.",
    excerpt_vi: "Khám phá ưu và nhược điểm của việc lập kế hoạch truyền thống so với AI, và tìm hiểu cách tiếp cận nào phù hợp với phong cách du lịch của bạn.",
    content: `
# Planning Your Trip: Do It Yourself or Let AI Handle It?

Travel planning has evolved dramatically in recent years. Gone are the days when you had to spend weeks researching destinations, booking accommodations, and creating detailed itineraries. Today, AI-powered travel planners like Pocket Atlas can create personalized trip plans in minutes.

## Traditional Trip Planning

**Pros:**
- Complete control over every detail
- Deep research and personal discovery
- Flexibility to change plans on the fly
- Learning about destinations through research

**Cons:**
- Time-consuming (can take weeks)
- Overwhelming amount of information
- Risk of missing hidden gems
- Difficult to optimize routes and timing

## AI-Powered Trip Planning

**Pros:**
- Instant itinerary generation
- Personalized recommendations based on preferences
- Optimized routes and timing
- Discovers hidden gems you might miss
- Considers budget and travel style
- Easy to modify and regenerate

**Cons:**
- Less hands-on research experience
- Requires trust in AI recommendations
- May need manual adjustments
- Less spontaneous discovery during planning

## The Best Approach

The ideal solution? Combine both! Use AI to create a solid foundation, then customize it with your personal touches. Let AI handle the heavy lifting of research and optimization, while you add the personal elements that make your trip unique.

With Pocket Atlas, you get:
- AI-generated base itinerary in seconds
- Drag-and-drop customization
- Real-time place information
- Budget estimation
- Flexible adjustments

Start planning smarter, not harder!
    `,
    content_vi: `
# Lập kế hoạch du lịch: Tự làm hay để AI xử lý?

Việc lập kế hoạch du lịch đã phát triển đáng kể trong những năm gần đây. Đã qua rồi thời đại bạn phải dành hàng tuần để nghiên cứu điểm đến, đặt chỗ ở và tạo lịch trình chi tiết. Ngày nay, các công cụ lập kế hoạch du lịch AI như Pocket Atlas có thể tạo kế hoạch chuyến đi cá nhân hóa chỉ trong vài phút.

## Lập kế hoạch truyền thống

**Ưu điểm:**
- Kiểm soát hoàn toàn mọi chi tiết
- Nghiên cứu sâu và khám phá cá nhân
- Linh hoạt thay đổi kế hoạch
- Học hỏi về điểm đến qua nghiên cứu

**Nhược điểm:**
- Tốn thời gian (có thể mất hàng tuần)
- Quá nhiều thông tin
- Có thể bỏ lỡ những địa điểm ẩn
- Khó tối ưu hóa lộ trình và thời gian

## Lập kế hoạch bằng AI

**Ưu điểm:**
- Tạo lịch trình ngay lập tức
- Đề xuất cá nhân hóa dựa trên sở thích
- Tối ưu hóa lộ trình và thời gian
- Khám phá những điểm đến ẩn
- Xem xét ngân sách và phong cách du lịch
- Dễ dàng chỉnh sửa và tạo lại

**Nhược điểm:**
- Ít trải nghiệm nghiên cứu thực hành
- Cần tin tưởng vào đề xuất của AI
- Có thể cần điều chỉnh thủ công
- Ít khám phá tự phát trong quá trình lập kế hoạch

## Cách tiếp cận tốt nhất

Giải pháp lý tưởng? Kết hợp cả hai! Sử dụng AI để tạo nền tảng vững chắc, sau đó tùy chỉnh với phong cách cá nhân. Để AI xử lý công việc nghiên cứu và tối ưu hóa, trong khi bạn thêm các yếu tố cá nhân khiến chuyến đi của bạn trở nên độc đáo.

Với Pocket Atlas, bạn nhận được:
- Lịch trình cơ bản do AI tạo trong vài giây
- Tùy chỉnh kéo thả
- Thông tin địa điểm thời gian thực
- Ước tính ngân sách
- Điều chỉnh linh hoạt

Bắt đầu lập kế hoạch thông minh hơn, không khó hơn!
    `,
    author: "Pocket Atlas Team",
    date: "2025-01-15",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800",
    category: "Travel Tips",
    tags: ["AI Travel", "Trip Planning", "Smart Travel"],
  },
  {
    id: "2",
    title: "The Ultimate Vietnam Travel Guide: Must-Visit Destinations",
    title_vi: "Hướng dẫn du lịch Việt Nam: Điểm đến không thể bỏ qua",
    slug: "vietnam-travel-guide",
    excerpt: "From bustling cities to serene beaches, discover the best destinations in Vietnam for an unforgettable journey.",
    excerpt_vi: "Từ thành phố nhộn nhịp đến bãi biển thanh bình, khám phá những điểm đến tuyệt vời nhất ở Việt Nam.",
    content: `
# The Ultimate Vietnam Travel Guide

Vietnam is a country of stunning natural beauty, rich history, and vibrant culture. Here are the must-visit destinations for your Vietnamese adventure.

## 1. Hanoi - The Capital of a Thousand Years

Explore the Old Quarter, visit Hoan Kiem Lake, and savor authentic pho in its birthplace. Don't miss:
- Temple of Literature
- Ho Chi Minh Mausoleum
- Train Street
- Night market

## 2. Ha Long Bay - UNESCO World Heritage

Cruise through emerald waters surrounded by thousands of limestone karsts and islands. Best activities:
- Overnight cruise
- Kayaking
- Cave exploration
- Swimming at hidden beaches

## 3. Hoi An - Ancient Town Magic

Walk through lantern-lit streets in this UNESCO World Heritage site. Must-do:
- Japanese Covered Bridge
- Old Town walking tour
- Tailor-made clothing
- Cooking classes
- An Bang Beach

## 4. Ho Chi Minh City - The Southern Hub

Experience the bustling metropolis with French colonial architecture and modern skyscrapers:
- Ben Thanh Market
- War Remnants Museum
- Notre-Dame Cathedral
- Cu Chi Tunnels
- Bui Vien Walking Street

## 5. Da Nang & Hue

Beautiful beaches and imperial history:
- Marble Mountains
- My Khe Beach
- Golden Bridge (Ba Na Hills)
- Imperial City of Hue
- Thien Mu Pagoda

## 6. Sapa - Mountain Retreat

Trek through terraced rice fields and meet ethnic minorities:
- Fansipan cable car
- Cat Cat Village
- Sapa Market
- Rice terrace photography

## Travel Tips

- **Best time to visit:** March-April and September-November
- **Visa:** Most nationalities need e-visa
- **Currency:** Vietnamese Dong (VND)
- **Language:** Vietnamese, but English is widely spoken in tourist areas
- **Transportation:** Grab app for taxis, domestic flights are affordable

Start planning your Vietnamese adventure with Pocket Atlas today!
    `,
    content_vi: `
# Hướng dẫn du lịch Việt Nam toàn diện

Việt Nam là đất nước có vẻ đẹp thiên nhiên tuyệt đẹp, lịch sử phong phú và văn hóa sôi động. Dưới đây là những điểm đến không thể bỏ qua cho cuộc phiêu lưu Việt Nam của bạn.

## 1. Hà Nội - Thủ đô ngàn năm văn hiến

Khám phá Phố Cổ, thăm Hồ Hoàn Kiếm và thưởng thức phở chính gốc. Đừng bỏ lỡ:
- Văn Miếu Quốc Tử Giám
- Lăng Chủ tịch Hồ Chí Minh
- Phố tàu
- Chợ đêm

## 2. Vịnh Hạ Long - Di sản UNESCO

Du thuyền qua vùng nước màu ngọc lục bảo được bao quanh bởi hàng nghìn đảo đá vôi. Hoạt động tốt nhất:
- Du thuyền qua đêm
- Chèo kayak
- Khám phá hang động
- Bơi lội tại bãi biển ẩn

## 3. Hội An - Phố cổ kỳ diệu

Đi bộ qua những con phố thắp đèn lồng tại di sản UNESCO này. Phải làm:
- Chùa Cầu Nhật Bản
- Tour đi bộ Phố Cổ
- May quần áo theo yêu cầu
- Lớp học nấu ăn
- Bãi biển An Bàng

## 4. TP. Hồ Chí Minh - Trung tâm phía Nam

Trải nghiệm đô thị nhộn nhịp với kiến trúc thuộc địa Pháp và nhà chọc trời hiện đại:
- Chợ Bến Thành
- Bảo tàng Chứng tích Chiến tranh
- Nhà thờ Đức Bà
- Địa đạo Củ Chi
- Phố đi bộ Bùi Viện

## 5. Đà Nẵng & Huế

Bãi biển đẹp và lịch sử hoàng gia:
- Ngũ Hành Sơn
- Bãi biển Mỹ Khê
- Cầu Vàng (Bà Nà Hills)
- Cố đô Huế
- Chùa Thiên Mụ

## 6. Sapa - Khu nghỉ dưỡng núi

Trekking qua ruộng bậc thang và gặp gỡ các dân tộc thiểu số:
- Cáp treo Fansipan
- Bản Cát Cát
- Chợ Sapa
- Chụp ảnh ruộng bậc thang

## Lời khuyên du lịch

- **Thời gian tốt nhất:** Tháng 3-4 và Tháng 9-11
- **Visa:** Hầu hết quốc tịch cần e-visa
- **Tiền tệ:** Đồng Việt Nam (VND)
- **Ngôn ngữ:** Tiếng Việt, nhưng tiếng Anh được nói rộng rãi ở khu vực du lịch
- **Giao thông:** Ứng dụng Grab cho taxi, chuyến bay nội địa giá cả phải chăng

Bắt đầu lập kế hoạch phiêu lưu Việt Nam của bạn với Pocket Atlas ngay hôm nay!
    `,
    author: "Travel Expert",
    date: "2025-01-10",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
    category: "Destination Guide",
    tags: ["Vietnam", "Travel Guide", "Southeast Asia"],
  },
  {
    id: "3",
    title: "Budget Travel Tips: See the World Without Breaking the Bank",
    title_vi: "Mẹo du lịch tiết kiệm: Khám phá thế giới mà không tốn kém",
    slug: "budget-travel-tips",
    excerpt: "Learn how to travel smart and save money with these expert tips for budget-conscious travelers.",
    excerpt_vi: "Học cách du lịch thông minh và tiết kiệm với những mẹo từ chuyên gia dành cho du khách có ngân sách.",
    content: `
# Budget Travel Tips: See the World Without Breaking the Bank

Traveling doesn't have to drain your savings. Here are proven strategies to explore the world on a budget.

## 1. Accommodation Hacks

**Save 50-70% on lodging:**
- Use hostels for social budget stays
- Book Airbnb apartments with kitchens
- Try house-sitting or home exchanges
- Stay in local guesthouses
- Use hotel comparison sites
- Book refundable rates for flexibility

## 2. Transportation Savings

**Get around for less:**
- Book flights 6-8 weeks in advance
- Use budget airlines strategically
- Travel during off-peak seasons
- Take overnight buses/trains to save accommodation
- Walk or bike in cities
- Use public transportation passes

## 3. Food on a Budget

**Eat well without overspending:**
- Shop at local markets
- Cook your own meals
- Eat street food (where safe)
- Lunch specials instead of dinner
- Bring reusable water bottle
- Share meals with travel companions

## 4. Free Activities

**Enjoy destinations without spending:**
- Free walking tours (tip-based)
- Public beaches and parks
- Free museum days
- City viewpoints
- Local festivals
- Nature hikes

## 5. Smart Booking Strategies

**Get the best deals:**
- Use price comparison websites
- Sign up for fare alerts
- Book package deals
- Consider shoulder season travel
- Use travel credit cards for points
- Book activities directly (skip tour companies)

## 6. Money Management

**Protect your budget:**
- Use no-foreign-fee credit cards
- Withdraw larger amounts less frequently
- Set daily spending limits
- Track expenses with apps
- Have emergency funds
- Buy travel insurance

## Budget-Friendly Destinations

**Great value countries:**
- Vietnam: $30-40/day
- Thailand: $35-45/day
- Portugal: $50-60/day
- Mexico: $40-50/day
- Indonesia: $30-40/day

## Use AI to Plan Budget Trips

Pocket Atlas considers your budget when generating itineraries:
- Suggests affordable activities
- Finds budget accommodations
- Optimizes routes to save transport costs
- Recommends local experiences

Start planning your budget-friendly adventure today!
    `,
    content_vi: `
# Mẹo du lịch tiết kiệm: Khám phá thế giới mà không tốn kém

Du lịch không nhất thiết phải làm cạn kiệt tiết kiệm của bạn. Dưới đây là các chiến lược đã được chứng minh để khám phá thế giới với ngân sách hạn chế.

## 1. Mẹo về chỗ ở

**Tiết kiệm 50-70% chi phí lưu trú:**
- Sử dụng nhà trọ để lưu trú tiết kiệm
- Đặt căn hộ Airbnb có bếp
- Thử trông nhà hoặc trao đổi nhà
- Ở nhà khách địa phương
- Sử dụng trang web so sánh khách sạn
- Đặt giá hoàn tiền để linh hoạt

## 2. Tiết kiệm chi phí di chuyển

**Di chuyển với chi phí thấp hơn:**
- Đặt vé máy bay trước 6-8 tuần
- Sử dụng hãng hàng không giá rẻ một cách chiến lược
- Du lịch trong mùa thấp điểm
- Đi xe buýt/tàu qua đêm để tiết kiệm chỗ ở
- Đi bộ hoặc đi xe đạp trong thành phố
- Sử dụng thẻ giao thông công cộng

## 3. Ăn uống tiết kiệm

**Ăn ngon mà không tốn kém:**
- Mua sắm ở chợ địa phương
- Tự nấu ăn
- Ăn đồ ăn đường phố (nơi an toàn)
- Ăn trưa thay vì ăn tối
- Mang theo chai nước tái sử dụng
- Chia sẻ bữa ăn với bạn đồng hành

## 4. Hoạt động miễn phí

**Thưởng thức điểm đến mà không tốn tiền:**
- Tour đi bộ miễn phí (dựa trên tiền boa)
- Bãi biển và công viên công cộng
- Ngày bảo tàng miễn phí
- Điểm ngắm cảnh thành phố
- Lễ hội địa phương
- Đi bộ đường dài thiên nhiên

## 5. Chiến lược đặt chỗ thông minh

**Nhận được giao dịch tốt nhất:**
- Sử dụng trang web so sánh giá
- Đăng ký cảnh báo giá vé
- Đặt gói ưu đãi
- Xem xét du lịch mùa vai
- Sử dụng thẻ tín dụng du lịch để tích điểm
- Đặt hoạt động trực tiếp (bỏ qua công ty du lịch)

## 6. Quản lý tiền

**Bảo vệ ngân sách của bạn:**
- Sử dụng thẻ tín dụng không phí ngoại tệ
- Rút số tiền lớn hơn ít thường xuyên hơn
- Đặt giới hạn chi tiêu hàng ngày
- Theo dõi chi tiêu bằng ứng dụng
- Có quỹ khẩn cấp
- Mua bảo hiểm du lịch

## Điểm đến thân thiện với ngân sách

**Quốc gia có giá trị lớn:**
- Việt Nam: $30-40/ngày
- Thái Lan: $35-45/ngày
- Bồ Đào Nha: $50-60/ngày
- Mexico: $40-50/ngày
- Indonesia: $30-40/ngày

## Sử dụng AI để lập kế hoạch chuyến đi tiết kiệm

Pocket Atlas xem xét ngân sách của bạn khi tạo lịch trình:
- Đề xuất hoạt động giá cả phải chăng
- Tìm chỗ ở giá rẻ
- Tối ưu hóa lộ trình để tiết kiệm chi phí di chuyển
- Đề xuất trải nghiệm địa phương

Bắt đầu lập kế hoạch phiêu lưu thân thiện với ngân sách của bạn ngay hôm nay!
    `,
    author: "Budget Travel Pro",
    date: "2025-01-05",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
    category: "Travel Tips",
    tags: ["Budget Travel", "Money Saving", "Travel Hacks"],
  },
  {
    id: "4",
    title: "Essential Packing List for Southeast Asia Adventures",
    title_vi: "Danh sách đồ cần thiết cho phiêu lưu Đông Nam Á",
    slug: "southeast-asia-packing-list",
    excerpt: "Pack smart for your Southeast Asia trip with this comprehensive packing guide covering essentials, clothing, and tech gear.",
    excerpt_vi: "Chuẩn bị hành lý thông minh cho chuyến đi Đông Nam Á với hướng dẫn toàn diện này.",
    content: `
# Essential Packing List for Southeast Asia

Planning a trip to Southeast Asia? Here's your ultimate packing guide to ensure you have everything you need.

## Documents & Money

✅ **Must-haves:**
- Passport (6+ months validity)
- Visa documents/e-visa printouts
- Travel insurance papers
- Digital & physical copies of important documents
- Credit cards (Visa/Mastercard widely accepted)
- Some USD cash for emergencies
- Local SIM card or international data plan

## Clothing

🎒 **What to pack:**
- 3-4 lightweight, quick-dry t-shirts
- 2 pairs of shorts
- 1-2 pairs of long pants
- Light jacket or sweater (for air-conditioned spaces)
- Swimwear
- Comfortable walking shoes
- Flip-flops/sandals
- Sun hat or cap
- Modest outfit for temples (covered shoulders & knees)

## Toiletries & Health

💊 **Health essentials:**
- Sunscreen (SPF 50+)
- Insect repellent (DEET-based)
- Hand sanitizer
- Basic first aid kit
- Prescription medications
- Anti-diarrheal medicine
- Rehydration salts
- Motion sickness pills
- Wet wipes

## Electronics

📱 **Tech gear:**
- Smartphone
- Power bank (10,000+ mAh)
- Universal travel adapter
- Camera (optional)
- Waterproof phone case
- Headphones
- E-reader for long journeys

## Accessories

🎒 **Useful items:**
- Daypack (20-30L)
- Dry bag for water activities
- Reusable water bottle
- Travel padlock
- Microfiber towel
- Ziplock bags
- Laundry detergent packets
- Sewing kit

## Weather Considerations

🌦️ **By season:**
- **Dry Season (Nov-Apr):** Light clothes, sunscreen
- **Wet Season (May-Oct):** Lightweight rain jacket, quick-dry gear

## Pro Tips

💡 **Packing wisdom:**
1. **Pack light:** You can buy most things locally
2. **Layer up:** Easier to adjust to temperature changes
3. **Neutral colors:** Hide stains and dirt better
4. **Compression bags:** Save space in your luggage
5. **Leave room:** For souvenirs and purchases
6. **Copies:** Keep digital backups of all documents

## What NOT to Pack

❌ **Leave at home:**
- Expensive jewelry
- Too many shoes (2-3 pairs max)
- Heavy books (use e-reader)
- Full-size toiletries (buy locally)
- Too many "just in case" items

## Country-Specific Notes

**Thailand:** Bring modest clothes for temples
**Vietnam:** Pack rain gear year-round
**Indonesia:** Reef-safe sunscreen for diving
**Cambodia:** Long sleeves for Angkor Wat sunrise
**Myanmar:** Cash (USD) as ATMs can be unreliable

## Use Pocket Atlas for Packing Lists

Our AI generates customized packing lists based on:
- Your destination
- Trip duration
- Planned activities
- Season and weather
- Personal preferences

Get your personalized packing list today!
    `,
    content_vi: `
# Danh sách đồ cần thiết cho Đông Nam Á

Đang lập kế hoạch cho chuyến đi Đông Nam Á? Đây là hướng dẫn chuẩn bị hành lý tối ưu của bạn.

## Giấy tờ & Tiền

✅ **Bắt buộc:**
- Hộ chiếu (còn hiệu lực 6+ tháng)
- Giấy tờ visa/in e-visa
- Giấy tờ bảo hiểm du lịch
- Bản sao kỹ thuật số và vật lý của giấy tờ quan trọng
- Thẻ tín dụng (Visa/Mastercard được chấp nhận rộng rãi)
- Một ít tiền mặt USD cho trường hợp khẩn cấp
- SIM địa phương hoặc gói dữ liệu quốc tế

## Quần áo

🎒 **Cần mang:**
- 3-4 áo phông nhẹ, khô nhanh
- 2 quần short
- 1-2 quần dài
- Áo khoác nhẹ hoặc áo len (cho không gian có điều hòa)
- Đồ bơi
- Giày đi bộ thoải mái
- Dép xỏ ngón/sandal
- Mũ che nắng
- Trang phục lịch sự cho đền chùa (che vai và đầu gối)

## Đồ vệ sinh & Sức khỏe

💊 **Thiết yếu về sức khỏe:**
- Kem chống nắng (SPF 50+)
- Thuốc xịt chống muỗi (dựa trên DEET)
- Nước rửa tay khô
- Bộ sơ cứu cơ bản
- Thuốc theo đơn
- Thuốc chống tiêu chảy
- Muối bù nước
- Thuốc say xe
- Khăn ướt

## Thiết bị điện tử

📱 **Thiết bị công nghệ:**
- Điện thoại thông minh
- Sạc dự phòng (10.000+ mAh)
- Ổ cắm du lịch đa năng
- Máy ảnh (tùy chọn)
- Ốp lưng chống nước
- Tai nghe
- Máy đọc sách điện tử

## Phụ kiện

🎒 **Đồ hữu ích:**
- Ba lô nhỏ (20-30L)
- Túi khô cho hoạt động nước
- Chai nước tái sử dụng
- Khóa du lịch
- Khăn microfiber
- Túi ziplock
- Gói bột giặt
- Bộ dụng cụ may vá

## Cân nhắc thời tiết

🌦️ **Theo mùa:**
- **Mùa khô (Tháng 11-Tháng 4):** Quần áo nhẹ, kem chống nắng
- **Mùa mưa (Tháng 5-Tháng 10):** Áo mưa nhẹ, đồ khô nhanh

## Mẹo chuyên nghiệp

💡 **Khôn ngoan trong việc đóng gói:**
1. **Đóng gói nhẹ:** Bạn có thể mua hầu hết mọi thứ tại địa phương
2. **Mặc nhiều lớp:** Dễ dàng điều chỉnh với thay đổi nhiệt độ
3. **Màu trung tính:** Che vết bẩn tốt hơn
4. **Túi nén:** Tiết kiệm không gian trong hành lý
5. **Để chỗ trống:** Cho quà lưu niệm
6. **Bản sao:** Giữ bản sao kỹ thuật số của tất cả giấy tờ

## Không nên mang

❌ **Để ở nhà:**
- Trang sức đắt tiền
- Quá nhiều giày (tối đa 2-3 đôi)
- Sách nặng (sử dụng máy đọc sách điện tử)
- Đồ vệ sinh cỡ lớn (mua tại địa phương)
- Quá nhiều đồ "phòng khi"

## Ghi chú theo quốc gia

**Thái Lan:** Mang quần áo lịch sự cho đền chùa
**Việt Nam:** Đóng gói đồ mưa quanh năm
**Indonesia:** Kem chống nắng an toàn cho rạn san hô
**Campuchia:** Áo tay dài cho bình minh Angkor Wat
**Myanmar:** Tiền mặt (USD) vì ATM có thể không đáng tin cậy

## Sử dụng Pocket Atlas cho danh sách đóng gói

AI của chúng tôi tạo danh sách đóng gói tùy chỉnh dựa trên:
- Điểm đến của bạn
- Thời gian chuyến đi
- Hoạt động đã lên kế hoạch
- Mùa và thời tiết
- Sở thích cá nhân

Nhận danh sách đóng gói cá nhân hóa của bạn ngay hôm nay!
    `,
    author: "Travel Gear Expert",
    date: "2024-12-28",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",
    category: "Travel Tips",
    tags: ["Packing", "Southeast Asia", "Travel Preparation"],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getBlogPostsByCategory(category: string): BlogPost[] {
  return blogPosts.filter((post) => post.category === category);
}

export function getBlogPostsByTag(tag: string): BlogPost[] {
  return blogPosts.filter((post) => post.tags.includes(tag));
}

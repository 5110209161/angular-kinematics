using ConnmunicationHub.Models;

namespace ConnmunicationHub.Utils
{
  public class DataManager
  {
    public static Joints GetMockedData()
    {
      var random = new Random();

      return new Joints
      {
        Joint1 = random.Next(-180, 180),
        Joint2 = random.Next(-180, 180),
        Joint3 = random.Next(-180, 180),
        Joint4 = random.Next(-180, 180),
        Joint5 = random.Next(-180, 180),
        Joint6 = random.Next(-180, 180)
      };
    }
  }
}
